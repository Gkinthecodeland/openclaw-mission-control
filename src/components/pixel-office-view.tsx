"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { SectionBody, SectionHeader, SectionLayout } from "@/components/section-layout";
import { PixelOfficeEngine } from "@/lib/pixel-office/engine";
import type { OfficeAgent, AgentActivity } from "@/lib/pixel-office/types";

/* ── API response types ──────────────────────────── */

type ApiAgent = {
  id: string;
  name: string;
  emoji: string;
  model: string;
  status: "active" | "idle" | "unknown";
  sessionCount: number;
  lastActive: number;
  totalTokens: number;
  runtimeSubagents: unknown[];
};

type ApiSession = {
  key: string;
  sessionId: string;
  updatedAt: number | null;
  ageMs: number | null;
  totalTokens: number;
  model: string;
};

/* ── agent color palette ─────────────────────────── */

const AGENT_COLORS: Record<string, { primary: string; secondary: string; skin: string }> = {
  donna: { primary: "#e07050", secondary: "#c05030", skin: "#f0c0a0" },
  jarvis: { primary: "#4090d0", secondary: "#2070b0", skin: "#e0c8a0" },
};

const FALLBACK_COLORS = [
  { primary: "#9060c0", secondary: "#7040a0", skin: "#e0c0b0" },
  { primary: "#50a060", secondary: "#308040", skin: "#e0c8a0" },
  { primary: "#40a0a0", secondary: "#208080", skin: "#e0c0b0" },
  { primary: "#c0a040", secondary: "#a08020", skin: "#e0c8a0" },
];

function getAgentColor(agentId: string, index: number): { primary: string; secondary: string; skin: string } {
  const key = agentId.toLowerCase();
  if (key in AGENT_COLORS) return AGENT_COLORS[key];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/* ── activity mapping ────────────────────────────── */

function mapActivity(agent: ApiAgent, sessions: ApiSession[]): AgentActivity {
  const agentSessions = sessions.filter((s) => s.key.includes(`agent:${agent.id}:`));
  const latestSession = agentSessions[0]; // already sorted by updatedAt desc

  if (agent.status === "unknown" || !latestSession) return "sleeping";

  const ageMs = latestSession.ageMs ?? (Date.now() - (latestSession.updatedAt ?? 0));

  if (ageMs < 10_000) return "typing";
  if (ageMs < 30_000) return "thinking";
  if (ageMs < 300_000) return "idle";
  return "sleeping";
}

/* ── task extraction ─────────────────────────────── */

function extractCurrentTask(agent: ApiAgent, sessions: ApiSession[]): string | null {
  const agentSessions = sessions.filter((s) => s.key.includes(`agent:${agent.id}:`));
  const latestSession = agentSessions[0];
  if (!latestSession) return null;

  const activity = mapActivity(agent, sessions);
  if (activity === "typing") return "Working...";
  if (activity === "thinking") return "Thinking...";
  return null;
}

/* ── build OfficeAgent[] from API data ───────────── */

function buildOfficeAgents(agents: ApiAgent[], sessions: ApiSession[]): OfficeAgent[] {
  return agents.map((agent, index) => ({
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    status: agent.status,
    activity: mapActivity(agent, sessions),
    color: getAgentColor(agent.id, index),
    deskIndex: index,
    currentTask: extractCurrentTask(agent, sessions),
  }));
}

/* ── polling interval ────────────────────────────── */

const POLL_MS = 5000;

/* ── component ───────────────────────────────────── */

export function PixelOfficeView() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelOfficeEngine | null>(null);

  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [sessions, setSessions] = useState<ApiSession[]>([]);

  /* ── data fetching ─────────────────────────────── */

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
      // Show office even with no data -- do not crash
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

  /* ── engine lifecycle ──────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new PixelOfficeEngine(canvas);
    engineRef.current = engine;
    engine.start();

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      engine.stop();
      engineRef.current = null;
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  /* ── sync agents into engine ───────────────────── */

  useEffect(() => {
    const officeAgents = buildOfficeAgents(agents, sessions);
    engineRef.current?.updateAgents(officeAgents);
  }, [agents, sessions]);

  /* ── click handling ────────────────────────────── */

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const engine = engineRef.current;
      if (!engine) return;

      const agent = engine.getAgentAt(e.clientX, e.clientY);
      if (agent) {
        router.push("/?section=sessions");
      }
    },
    [router],
  );

  /* ── active agent count ────────────────────────── */

  const activeCount = agents.filter((a) => a.status !== "unknown").length;

  /* ── render ────────────────────────────────────── */

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
        <div className="relative h-full w-full bg-[#1a1a2e]">
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-pointer"
            style={{ imageRendering: "pixelated" }}
            onClick={handleCanvasClick}
          />
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
        </div>
      </SectionBody>
    </SectionLayout>
  );
}
