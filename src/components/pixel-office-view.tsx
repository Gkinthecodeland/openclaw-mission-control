"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Users } from "lucide-react";
import {
  SectionBody,
  SectionHeader,
  SectionLayout,
} from "@/components/section-layout";
import { OfficeStateManager } from "@/lib/pixel-office/office-state";
import { PixelOfficeRenderer } from "@/lib/pixel-office/renderer";
import type {
  OfficeAgent,
  Character,
  GameState,
  FloorData,
  AgentActivity,
} from "@/lib/pixel-office/types";
import { FloorId, TARGET_FPS, POLL_MS } from "@/lib/pixel-office/types";

// ---------------------------------------------------------------------------
// Hover info card state
// ---------------------------------------------------------------------------

interface HoverInfo {
  name: string;
  emoji: string;
  model: string;
  task: string | null;
  tokens: number;
  status: string;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFloorName(floor: FloorId): string {
  switch (floor) {
    case FloorId.GROUND:
      return "Ground Floor";
    case FloorId.UPPER:
      return "Upper Floor";
    case FloorId.BASEMENT:
      return "Basement";
    case FloorId.ROOFTOP:
      return "Rooftop";
    default:
      return "Unknown";
  }
}

/** Keys that the game loop consumes — prevent browser default for these. */
const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "Enter",
  "Tab",
  "Escape",
]);

const FRAME_INTERVAL = 1000 / TARGET_FPS;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Activity mapping (same logic as V2)
// ---------------------------------------------------------------------------

function mapActivity(ageMs: number): AgentActivity {
  if (ageMs < 10_000) return "typing";
  if (ageMs < 30_000) return "thinking";
  if (ageMs < 300_000) return "idle";
  return "sleeping";
}

function buildOfficeAgents(sessions: Record<string, unknown>[], agents: Record<string, unknown>[]): OfficeAgent[] {
  const sessionMap = new Map<string, number>();
  const now = Date.now();
  for (const s of sessions) {
    const agentId = String(s.agentId ?? s.agent_id ?? "");
    const updated = s.updatedAt ?? s.updated_at ?? s.lastActivity ?? s.last_activity;
    if (agentId && updated) {
      const age = now - new Date(String(updated)).getTime();
      const existing = sessionMap.get(agentId);
      if (existing === undefined || age < existing) sessionMap.set(agentId, age);
    }
  }

  return agents.map((a) => {
    const id = String(a.id ?? "");
    const ageMs = sessionMap.get(id) ?? Infinity;
    const activity = mapActivity(ageMs);
    return {
      id,
      name: String(a.name ?? "Agent"),
      emoji: String(a.emoji ?? "🤖"),
      status: (activity === "typing" || activity === "thinking" ? "active" : activity === "idle" ? "idle" : "unknown") as "active" | "idle" | "unknown",
      activity,
      currentTask: (a.currentTask as string) ?? (a.current_task as string) ?? null,
      model: String(a.model ?? ""),
      totalTokens: Number(a.totalTokens ?? a.total_tokens ?? 0),
      isSubagent: Boolean(a.isSubagent ?? a.is_subagent ?? false),
      parentId: a.parentId ? String(a.parentId) : a.parent_id ? String(a.parent_id) : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PixelOfficeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OfficeStateManager | null>(null);
  const rendererRef = useRef<PixelOfficeRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const gameStateRef = useRef<GameState | null>(null);
  const floorsRef = useRef<Map<FloorId, FloorData> | null>(null);

  // React overlay state — updated periodically, not every frame
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [currentFloor, setCurrentFloor] = useState("Ground Floor");
  const [fps, setFps] = useState(0);

  // ----- Data fetching (internal polling) ----------------------------------

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const [agentsRes, sessionsRes] = await Promise.all([
          fetch("/api/agents", { cache: "no-store" }),
          fetch("/api/sessions", { cache: "no-store" }),
        ]);
        if (!mounted) return;
        const agentsJson = agentsRes.ok ? await agentsRes.json() : { agents: [] };
        const sessionsJson = sessionsRes.ok ? await sessionsRes.json() : { sessions: [] };
        const agentList = Array.isArray(agentsJson) ? agentsJson : (agentsJson.agents ?? []);
        const sessionList = Array.isArray(sessionsJson) ? sessionsJson : (sessionsJson.sessions ?? []);
        const officeAgents = buildOfficeAgents(sessionList, agentList);
        stateRef.current?.updateAgents(officeAgents);
      } catch {
        // silently retry next poll
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // ----- Initialize engine + game loop -------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stateManager = new OfficeStateManager();
    const renderer = new PixelOfficeRenderer(canvas);
    stateRef.current = stateManager;
    rendererRef.current = renderer;

    let running = true;
    let frameCount = 0;
    let fpsTimer = 0;

    const loop = (timestamp: number): void => {
      if (!running) return;
      animFrameRef.current = requestAnimationFrame(loop);

      const rawDt = timestamp - lastTimeRef.current;
      if (rawDt < FRAME_INTERVAL) return;

      // Align to frame boundary to avoid drift
      lastTimeRef.current = timestamp - (rawDt % FRAME_INTERVAL);
      const dt = Math.min(rawDt / 1000, 0.1);

      stateManager.update(dt);
      const gameState: GameState = stateManager.getState();
      const floors: Map<FloorId, FloorData> = stateManager.getFloors();
      gameStateRef.current = gameState;
      floorsRef.current = floors;

      renderer.render(gameState, floors, dt);

      // FPS tracking (once per second)
      frameCount++;
      fpsTimer += rawDt;
      if (fpsTimer >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTimer = 0;
      }

      // Update React overlay state every ~30 frames to avoid excessive re-renders
      if (gameState.frame % 30 === 0) {
        setActiveCount(
          gameState.characters.filter(
            (c: Character) =>
              c.state === "type" || c.state === "think",
          ).length,
        );
        setCurrentFloor(getFloorName(gameState.currentFloor));
      }
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      stateRef.current = null;
      rendererRef.current = null;
      gameStateRef.current = null;
      floorsRef.current = null;
    };
  }, []);

  // ----- Keyboard events ---------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (GAME_KEYS.has(e.code)) {
        e.preventDefault();
      }
      stateRef.current?.handleKeyDown(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      stateRef.current?.handleKeyUp(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // ----- Canvas resize -----------------------------------------------------

  useEffect(() => {
    const handleResize = (): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      rendererRef.current?.resize(rect.width, rect.height);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ----- Hit-testing helper ------------------------------------------------

  const hitTest = useCallback(
    (
      e: React.MouseEvent,
    ): { type: "character"; character: Character } | { type: "cat" } | null => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      const gameState = gameStateRef.current;
      const floors = floorsRef.current;
      if (!canvas || !renderer || !gameState || !floors) return null;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return renderer.getEntityAt(x, y, gameState, floors);
    },
    [],
  );

  // ----- Mouse handlers ----------------------------------------------------

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      const hit = hitTest(e);
      if (hit?.type === "character") {
        const char = hit.character;
        setHoverInfo({
          name: char.name,
          emoji: char.emoji,
          model: char.model,
          task: char.currentTask,
          tokens: char.totalTokens,
          status: char.status,
          x: e.clientX,
          y: e.clientY,
        });
      } else {
        setHoverInfo(null);
      }
    },
    [hitTest],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent): void => {
      const hit = hitTest(e);
      if (hit?.type === "character") {
        stateRef.current?.handleClick(hit.character, false);
      } else if (hit?.type === "cat") {
        stateRef.current?.handleClick(null, true);
      }
    },
    [hitTest],
  );

  const handleMouseLeave = useCallback((): void => {
    setHoverInfo(null);
  }, []);

  // ----- Render ------------------------------------------------------------

  return (
    <SectionLayout>
      <SectionHeader
        title="Pixel Office"
        description="Pokemon Red Edition"
        actions={
          <span className="flex items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {activeCount} active
          </span>
        }
      />
      <SectionBody width="full" padding="none">
        <div className="relative h-full w-full overflow-hidden bg-black">
          <canvas
            ref={canvasRef}
            className="block h-full w-full cursor-pointer"
            style={{ imageRendering: "pixelated" }}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onMouseLeave={handleMouseLeave}
          />

          {/* Floor indicator */}
          <div className="absolute left-2 top-2 rounded bg-black/50 px-2 py-1 font-mono text-xs text-white/70">
            {currentFloor}
          </div>

          {/* Active agents count */}
          <div className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 font-mono text-xs text-white/70">
            {activeCount} active
          </div>

          {/* FPS counter */}
          <div className="absolute bottom-2 left-2 font-mono text-xs text-white/40">
            {fps} FPS
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-2 right-2 font-mono text-xs text-white/40">
            WASD/Arrows: Move &middot; Space: Talk &middot; Tab: Spectate
          </div>

          {/* Legend */}
          <div className="absolute bottom-8 right-2 flex flex-col gap-1 font-mono text-xs text-white/60">
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Active
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              Thinking
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-500" />
              Idle
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-800" />
              Sleeping
            </div>
          </div>

          {/* Hover info card */}
          {hoverInfo && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-gray-700 bg-gray-900/95 px-3 py-2 font-mono text-xs text-white"
              style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 10 }}
            >
              <div className="font-bold">
                {hoverInfo.emoji} {hoverInfo.name}
              </div>
              {hoverInfo.model && (
                <div className="text-gray-400">{hoverInfo.model}</div>
              )}
              {hoverInfo.task && (
                <div className="max-w-48 truncate text-green-400">
                  {hoverInfo.task}
                </div>
              )}
              {hoverInfo.tokens > 0 && (
                <div className="text-yellow-400">
                  {(hoverInfo.tokens / 1000).toFixed(1)}K tokens
                </div>
              )}
              <div
                className={
                  hoverInfo.status === "active"
                    ? "text-green-500"
                    : "text-gray-500"
                }
              >
                {hoverInfo.status}
              </div>
            </div>
          )}
        </div>
      </SectionBody>
    </SectionLayout>
  );
}
