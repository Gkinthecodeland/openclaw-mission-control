"use client";

import { useEffect, useState, useRef } from "react";

type ActivityItem = {
  time: string;
  type: "message" | "tool" | "image" | "exec" | "inbound";
  icon: string;
  text: string;
};

type Stats = {
  agentId: string;
  totalLines: number;
  fileSizeKB: number;
  lastUpdated: number | null;
};

type MonitorData = {
  stats: Stats;
  activities: ActivityItem[];
};

function timeAgo(ts: string | number | null): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

const typeBg: Record<string, string> = {
  message: "bg-blue-500/10 border-blue-500/20",
  image: "bg-green-500/10 border-green-500/20",
  exec: "bg-yellow-500/10 border-yellow-500/20",
  tool: "bg-purple-500/10 border-purple-500/20",
  inbound: "bg-zinc-500/10 border-zinc-500/20",
};

export default function AgentMonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agent] = useState("marketing-lead");
  const [pollInterval] = useState(5000);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/agents/monitor?agent=${agent}&limit=100`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (mounted) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(String(err));
      }
    };
    poll();
    const id = setInterval(poll, pollInterval);
    return () => { mounted = false; clearInterval(id); };
  }, [agent, pollInterval]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data, autoScroll]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎬</span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Steve Monitor</h1>
            <p className="text-xs text-muted-foreground">
              Live activity feed — marketing-lead agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {data?.stats && (
            <>
              <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                {data.stats.totalLines} lines
              </span>
              <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                {data.stats.fileSizeKB} KB
              </span>
              <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                Updated {timeAgo(data.stats.lastUpdated)}
              </span>
            </>
          )}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded border text-xs ${
              autoScroll
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-zinc-800 border-zinc-700"
            }`}
          >
            {autoScroll ? "⬇ Auto-scroll ON" : "⬇ Auto-scroll OFF"}
          </button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Polling every {pollInterval / 1000}s
      </div>

      {error && (
        <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-2">
        {data?.activities.map((item, i) => (
          <div
            key={`${item.time}-${i}`}
            className={`flex gap-3 px-3 py-2 rounded border text-sm ${typeBg[item.type] || "bg-zinc-800 border-zinc-700"}`}
          >
            <span className="text-base flex-shrink-0">{item.icon}</span>
            <span className="text-[11px] text-muted-foreground flex-shrink-0 font-mono w-[70px]">
              {formatTime(item.time)}
            </span>
            <span className="text-foreground/90 break-words min-w-0">
              {item.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {data?.activities.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No activity yet — waiting for Steve...
        </div>
      )}
    </div>
  );
}
