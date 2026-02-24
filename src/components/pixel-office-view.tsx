"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import {
  SectionBody,
  SectionHeader,
  SectionLayout,
} from "@/components/section-layout";
import { OfficeStateManager } from "@/lib/pixel-office/office-state";
import { PixelOfficeRenderer } from "@/lib/pixel-office/renderer";
import type { OfficeAgent, AgentActivity, OfficeState } from "@/lib/pixel-office/types";
import { TARGET_FPS } from "@/lib/pixel-office/types";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

type ApiSubagent = {
  sessionKey: string;
  model: string;
  totalTokens: number;
  lastActive: number;
  ageMs: number;
  status: string;
};

type ApiAgent = {
  id: string;
  name: string;
  emoji: string;
  model: string;
  status: "active" | "idle" | "unknown";
  sessionCount: number;
  lastActive: number;
  totalTokens: number;
  runtimeSubagents: ApiSubagent[];
};

type ApiSession = {
  key: string;
  sessionId: string;
  updatedAt: number | null;
  ageMs: number | null;
  totalTokens: number;
  model: string;
};

// ---------------------------------------------------------------------------
// Agent color palette
// ---------------------------------------------------------------------------

const AGENT_COLORS: Record<
  string,
  { primary: string; secondary: string; skin: string }
> = {
  donna: { primary: "#e07050", secondary: "#c05030", skin: "#f0c0a0" },
  jarvis: { primary: "#4090d0", secondary: "#2070b0", skin: "#e0c8a0" },
};

const FALLBACK_COLORS = [
  { primary: "#9060c0", secondary: "#7040a0", skin: "#e0c0b0" },
  { primary: "#50a060", secondary: "#308040", skin: "#e0c8a0" },
  { primary: "#40a0a0", secondary: "#208080", skin: "#e0c0b0" },
  { primary: "#c0a040", secondary: "#a08020", skin: "#e0c8a0" },
];

function getAgentColor(
  agentId: string,
  index: number,
): { primary: string; secondary: string; skin: string } {
  const key = agentId.toLowerCase();
  if (key in AGENT_COLORS) return AGENT_COLORS[key];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// ---------------------------------------------------------------------------
// Activity mapping
// ---------------------------------------------------------------------------

function mapActivity(agent: ApiAgent, sessions: ApiSession[]): AgentActivity {
  const agentSessions = sessions.filter((s) =>
    s.key.includes(`agent:${agent.id}:`),
  );
  const latestSession = agentSessions[0];

  if (agent.status === "unknown" || !latestSession) return "sleeping";

  const ageMs =
    latestSession.ageMs ?? Date.now() - (latestSession.updatedAt ?? 0);

  if (ageMs < 10_000) return "typing";
  if (ageMs < 30_000) return "thinking";
  if (ageMs < 300_000) return "idle";
  return "sleeping";
}

// ---------------------------------------------------------------------------
// Task extraction
// ---------------------------------------------------------------------------

function extractCurrentTask(
  agent: ApiAgent,
  sessions: ApiSession[],
): string | null {
  const agentSessions = sessions.filter((s) =>
    s.key.includes(`agent:${agent.id}:`),
  );
  const latestSession = agentSessions[0];
  if (!latestSession) return null;

  const activity = mapActivity(agent, sessions);
  if (activity === "typing") return "Working...";
  if (activity === "thinking") return "Thinking...";
  return null;
}

// ---------------------------------------------------------------------------
// Build OfficeAgent[] from API data
// ---------------------------------------------------------------------------

function buildOfficeAgents(
  agents: ApiAgent[],
  sessions: ApiSession[],
): OfficeAgent[] {
  const result: OfficeAgent[] = [];

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    result.push({
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      status: agent.status,
      activity: mapActivity(agent, sessions),
      color: getAgentColor(agent.id, i),
      currentTask: extractCurrentTask(agent, sessions),
      model: agent.model,
      totalTokens: agent.totalTokens,
    });

    // Sub-agents
    if (agent.runtimeSubagents && agent.runtimeSubagents.length > 0) {
      for (let j = 0; j < agent.runtimeSubagents.length; j++) {
        const sub = agent.runtimeSubagents[j];
        result.push({
          id: `${agent.id}_sub_${j}`,
          name: `${agent.name}-sub`,
          emoji: agent.emoji,
          status: sub.status === "active" ? "active" : "idle",
          activity: sub.ageMs < 10_000 ? "typing" : "idle",
          color: getAgentColor(agent.id, i),
          currentTask: sub.status === "active" ? "Working..." : null,
          model: sub.model,
          totalTokens: sub.totalTokens,
          isSubagent: true,
          parentId: agent.id,
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Polling interval
// ---------------------------------------------------------------------------

const POLL_MS = 5000;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// ---------------------------------------------------------------------------
// Hover info type
// ---------------------------------------------------------------------------

interface HoverInfo {
  agentId: string;
  name: string;
  emoji: string;
  model?: string;
  currentTask: string | null;
  totalTokens?: number;
  status: "active" | "idle" | "unknown";
  screenX: number;
  screenY: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PixelOfficeView() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateManagerRef = useRef<OfficeStateManager | null>(null);
  const rendererRef = useRef<PixelOfficeRenderer | null>(null);
  const officeStateRef = useRef<OfficeState | null>(null);

  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [fps, setFps] = useState(0);

  // --- Data fetching ---

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, sessionsRes] = await Promise.allSettled([
        fetch("/api/agents", { cache: "no-store" }),
        fetch("/api/sessions", { cache: "no-store" }),
      ]);

      if (agentsRes.status === "fulfilled" && agentsRes.value.ok) {
        const data: { agents?: ApiAgent[] } = await agentsRes.value.json();
        setAgents(data.agents ?? []);
      }

      if (sessionsRes.status === "fulfilled" && sessionsRes.value.ok) {
        const data: { sessions?: ApiSession[] } = await sessionsRes.value.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // Office works even without data
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    queueMicrotask(() => void fetchData());
  }, [fetchData]);

  // Polling
  useEffect(() => {
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchData();
    }, POLL_MS);

    const onFocus = () => void fetchData();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchData]);

  // --- Engine lifecycle ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stateManager = new OfficeStateManager();
    const renderer = new PixelOfficeRenderer(canvas);
    stateManagerRef.current = stateManager;
    rendererRef.current = renderer;

    let lastFrameTime = performance.now();
    let running = true;
    let rafId: number;
    let frameCount = 0;
    let fpsTimer = 0;

    const loop = (now: number): void => {
      if (!running) return;
      rafId = requestAnimationFrame(loop);

      const rawDt = now - lastFrameTime;
      if (rawDt < FRAME_INTERVAL) return;

      lastFrameTime = now - (rawDt % FRAME_INTERVAL);
      const dt = Math.min(rawDt / 1000, 0.1);

      stateManager.update(dt);
      const state = stateManager.getState();
      officeStateRef.current = state;
      renderer.render(state, dt);

      // FPS tracking
      frameCount++;
      fpsTimer += rawDt;
      if (fpsTimer >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTimer = 0;
      }
    };

    rafId = requestAnimationFrame(loop);

    const handleResize = () => renderer.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      stateManagerRef.current = null;
      rendererRef.current = null;
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // --- Sync agents into state manager ---

  useEffect(() => {
    const officeAgents = buildOfficeAgents(agents, sessions);
    stateManagerRef.current?.updateAgents(officeAgents);
  }, [agents, sessions]);

  // --- Mouse handlers ---

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const renderer = rendererRef.current;
      const state = officeStateRef.current;
      if (!renderer || !state) return;

      const entity = renderer.getEntityAt(e.clientX, e.clientY, state);
      if (entity && entity.type === "agent") {
        router.push("/?section=sessions");
      }
    },
    [router],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const renderer = rendererRef.current;
      const state = officeStateRef.current;
      if (!renderer || !state) return;

      const entity = renderer.getEntityAt(e.clientX, e.clientY, state);
      if (entity && entity.type === "agent") {
        const char = state.characters.find((c) => c.id === entity.id);
        if (char) {
          setHoverInfo({
            agentId: char.id,
            name: char.name,
            emoji: char.emoji,
            model: char.model,
            currentTask: char.currentTask,
            totalTokens: char.totalTokens,
            status: char.status,
            screenX: e.clientX,
            screenY: e.clientY,
          });
          return;
        }
      }
      setHoverInfo(null);
    },
    [],
  );

  const handleCanvasMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  // --- Active agent count ---

  const activeCount = agents.filter((a) => a.status !== "unknown").length;

  // --- Render ---

  return (
    <SectionLayout>
      <SectionHeader
        title="Pixel Office"
        description="Your AI team at work"
        actions={
          <span className="flex items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {activeCount} agent{activeCount !== 1 ? "s" : ""} online
          </span>
        }
      />
      <SectionBody width="full" padding="none">
        <div className="relative h-full w-full bg-[#0D0D1A]">
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-pointer"
            style={{ imageRendering: "pixelated" }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
          />

          {/* FPS counter */}
          <div className="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 text-[10px] font-mono text-muted-foreground/60">
            {fps} FPS
          </div>

          {/* Legend overlay */}
          <div className="absolute bottom-4 right-4 rounded-lg bg-black/50 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-400" /> Working
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-yellow-400" /> Thinking
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-400" /> Idle
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-600" /> Offline
              </span>
            </div>
          </div>

          {/* Hover info card */}
          {hoverInfo && (
            <div
              className="pointer-events-none absolute z-50 rounded-lg border border-foreground/10 bg-background/90 p-3 text-xs shadow-lg backdrop-blur-sm"
              style={{
                left: hoverInfo.screenX + 16,
                top: hoverInfo.screenY - 80,
              }}
            >
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <span>{hoverInfo.emoji}</span>
                <span>{hoverInfo.name}</span>
              </div>
              {hoverInfo.model && (
                <div className="text-muted-foreground">{hoverInfo.model}</div>
              )}
              {hoverInfo.currentTask && (
                <div className="mt-1 text-muted-foreground">
                  {hoverInfo.currentTask}
                </div>
              )}
              {hoverInfo.totalTokens !== undefined && (
                <div className="mt-1 text-muted-foreground">
                  {hoverInfo.totalTokens.toLocaleString()} tokens
                </div>
              )}
              <div className="mt-1 flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hoverInfo.status === "active"
                      ? "bg-green-400"
                      : hoverInfo.status === "idle"
                        ? "bg-yellow-400"
                        : "bg-gray-500"
                  }`}
                />
                <span className="capitalize text-muted-foreground">
                  {hoverInfo.status}
                </span>
              </div>
            </div>
          )}
        </div>
      </SectionBody>
    </SectionLayout>
  );
}
