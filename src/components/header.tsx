"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  Pause,
  Play,
  Zap,
  Send,
  ChevronDown,
  Check,
  AlertTriangle,
  Loader2,
  X,
  Wifi,
  WifiOff,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchModal } from "./search-modal";
import { PairingNotifications } from "./pairing-notifications";
import { ThemeToggle } from "./theme-toggle";

/* ── Types ──────────────────────────────────────── */

type AgentInfo = {
  id: string;
  name: string;
  model: string;
};

type GatewayHealth = Record<string, unknown>;
type GatewayStatus = "online" | "degraded" | "offline" | "loading";

type CommandState = "idle" | "sending" | "success" | "error";

/* ── Quick Command Popover ──────────────────────── */

function QuickCommandPopover({ onClose }: { onClose: () => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<CommandState>("idle");
  const [response, setResponse] = useState("");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch agents
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.agents || data || []) as AgentInfo[];
        setAgents(list);
        if (list.length > 0) setSelectedAgent(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Focus input on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const send = useCallback(async () => {
    if (!prompt.trim() || !selectedAgent || state === "sending") return;
    setState("sending");
    setResponse("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: selectedAgent,
          messages: [
            {
              role: "user",
              id: crypto.randomUUID(),
              parts: [{ type: "text", text: prompt.trim() }],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();
      setResponse(text.slice(0, 500) + (text.length > 500 ? "…" : ""));
      setState("success");
    } catch (err) {
      setResponse(String(err));
      setState("error");
    }
  }, [prompt, selectedAgent, state]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  const currentAgent = agents.find((a) => a.id === selectedAgent);

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-24px)] max-w-[420px] overflow-hidden rounded-xl border border-foreground/[0.08] bg-card/95 shadow-2xl backdrop-blur-sm sm:w-[420px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-foreground/[0.06] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[12px] font-medium text-foreground/70">
            Quick Command
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Agent selector */}
      <div className="border-b border-foreground/[0.06] px-3 py-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAgentPicker(!showAgentPicker)}
            className="flex w-full items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]"
          >
            <span className="text-[11px] text-muted-foreground">Agent:</span>
            <span className="flex-1 truncate text-[12px] font-medium text-foreground/70">
              {currentAgent?.name || currentAgent?.id || "Select agent..."}
            </span>
            {currentAgent?.model && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground/60">
                {currentAgent.model.split("/").pop()}
              </span>
            )}
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          </button>

          {showAgentPicker && agents.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-foreground/[0.08] bg-card py-1 shadow-lg">
              {agents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelectedAgent(a.id);
                    setShowAgentPicker(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-violet-500/10",
                    a.id === selectedAgent && "bg-violet-500/5"
                  )}
                >
                  <span className="text-[12px] font-medium text-foreground/70">
                    {a.name || a.id}
                  </span>
                  {a.model && (
                    <span className="ml-auto text-[10px] text-muted-foreground/60">
                      {a.model.split("/").pop()}
                    </span>
                  )}
                  {a.id === selectedAgent && (
                    <Check className="h-3 w-3 shrink-0 text-violet-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a quick command for the agent..."
            rows={2}
            disabled={state === "sending"}
            className="flex-1 resize-none rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2 text-[12px] text-foreground/90 placeholder:text-muted-foreground/60 focus:border-violet-500/30 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={!prompt.trim() || !selectedAgent || state === "sending"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
          >
            {state === "sending" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/40">
            Enter to send · Shift+Enter for newline
          </span>
          {state === "sending" && (
            <span className="flex items-center gap-1 text-[10px] text-violet-400">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Agent thinking...
            </span>
          )}
        </div>
      </div>

      {/* Response */}
      {(state === "success" || state === "error") && response && (
        <div
          className={cn(
            "border-t border-foreground/[0.06] px-3 py-2",
            state === "error" && "bg-red-500/[0.03]"
          )}
        >
          <div className="mb-1 flex items-center gap-1">
            {state === "success" ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-red-400" />
            )}
            <span
              className={cn(
                "text-[10px] font-medium",
                state === "success" ? "text-emerald-400" : "text-red-400"
              )}
            >
              {state === "success" ? "Agent responded" : "Error"}
            </span>
          </div>
          <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
            {response}
          </p>
          {state === "success" && (
            <button
              type="button"
              onClick={() => {
                setPrompt("");
                setResponse("");
                setState("idle");
                inputRef.current?.focus();
              }}
              className="mt-1.5 text-[10px] text-violet-400 transition-colors hover:text-violet-300"
            >
              Send another →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Pause/Resume Gateway ───────────────────────── */

function usePauseState() {
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      if (paused) {
        await fetch("/api/gateway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restart" }),
        });
      } else {
        await fetch("/api/gateway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        });
      }
      setPaused(!paused);
    } catch {
      // ignore
    }
    setBusy(false);
  }, [paused]);

  return { paused, busy, toggle };
}

/* ── Gateway Status Hook ───────────────────────── */

function useGatewayStatus() {
  const [status, setStatus] = useState<GatewayStatus>("loading");
  const [health, setHealth] = useState<GatewayHealth | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/gateway");
        const data = await res.json();
        if (active) {
          setStatus((data.status as GatewayStatus) || "offline");
          setHealth((data.health as GatewayHealth) || null);
        }
      } catch {
        if (active) setStatus("offline");
      }
    };
    poll();
    const interval = setInterval(poll, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { status, health };
}

/* ── Gateway Status Badge ──────────────────────── */

function GatewayStatusBadge({
  status,
  health,
}: {
  status: GatewayStatus;
  health: GatewayHealth | null;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setShowPopover(true);
  }, []);

  const handleLeave = useCallback(() => {
    hideTimeout.current = setTimeout(() => setShowPopover(false), 200);
  }, []);

  // Extract useful details from health
  const details = useMemo(() => {
    if (!health) return null;
    const gw = health.gateway as Record<string, unknown> | undefined;
    const rawChannels = health.channels;
    const rawAgents = health.agents;
    const version = (gw?.version as string) || null;
    const mode = (gw?.mode as string) || null;
    const port = (gw?.port as number) || 18789;
    const uptime = gw?.uptimeMs as number | undefined;

    // channels/agents may be arrays, objects, or missing — handle all cases
    const channelsArr = Array.isArray(rawChannels) ? rawChannels : [];
    const agentsArr = Array.isArray(rawAgents)
      ? rawAgents
      : rawAgents && typeof rawAgents === "object"
        ? Object.values(rawAgents)
        : [];

    const channelCount = channelsArr.length;
    const activeChannels = channelsArr.filter(
      (c: Record<string, unknown>) => c.connected || c.enabled
    ).length;
    const agentCount = agentsArr.length;

    let uptimeStr: string | null = null;
    if (uptime && uptime > 0) {
      const hours = Math.floor(uptime / 3_600_000);
      const mins = Math.floor((uptime % 3_600_000) / 60_000);
      uptimeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    return { version, mode, port, uptimeStr, channelCount, activeChannels, agentCount };
  }, [health]);

  const statusConfig = {
    online: {
      dot: "bg-emerald-400",
      ping: true,
      text: "text-emerald-500 dark:text-emerald-400",
      label: "Online",
      bg: "bg-emerald-500/[0.08] border-emerald-500/20",
      icon: Wifi,
    },
    degraded: {
      dot: "bg-amber-400",
      ping: false,
      text: "text-amber-500 dark:text-amber-400",
      label: "Degraded",
      bg: "bg-amber-500/[0.08] border-amber-500/20",
      icon: Activity,
    },
    offline: {
      dot: "bg-red-400",
      ping: false,
      text: "text-red-500 dark:text-red-400",
      label: "Offline",
      bg: "bg-red-500/[0.08] border-red-500/20",
      icon: WifiOff,
    },
    loading: {
      dot: "bg-zinc-400 animate-pulse",
      ping: false,
      text: "text-muted-foreground",
      label: "Checking…",
      bg: "bg-foreground/[0.04] border-foreground/[0.08]",
      icon: Loader2,
    },
  };

  const cfg = statusConfig[status];
  const Icon = cfg.icon;

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className={cn(
          "flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
          cfg.bg
        )}
      >
        {/* Dot */}
        <span className="relative flex h-2 w-2">
          {cfg.ping && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-50",
                cfg.dot
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              cfg.dot
            )}
          />
        </span>
        {/* Label */}
        <span className={cn("text-[11px] font-medium", cfg.text)}>
          {cfg.label}
        </span>
      </div>

      {/* Popover */}
      {showPopover && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-foreground/[0.08] bg-card/95 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className={cn("flex items-center gap-2.5 px-3.5 py-3 border-b border-foreground/[0.06]", cfg.bg)}>
            <Icon className={cn("h-4 w-4", cfg.text, status === "loading" && "animate-spin")} />
            <div>
              <p className={cn("text-[12px] font-semibold", cfg.text)}>
                Gateway {cfg.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {status === "offline"
                  ? "Cannot reach gateway process"
                  : status === "degraded"
                    ? "Some services may be unavailable"
                    : status === "loading"
                      ? "Checking gateway health…"
                      : "All systems operational"}
              </p>
            </div>
          </div>

          {/* Details */}
          {details && status !== "loading" && (
            <div className="space-y-0 divide-y divide-foreground/[0.04] px-3.5 py-1">
              {details.uptimeStr && (
                <DetailRow label="Uptime" value={details.uptimeStr} />
              )}
              {details.version && (
                <DetailRow label="Version" value={details.version} />
              )}
              <DetailRow label="Port" value={String(details.port)} />
              {details.mode && (
                <DetailRow label="Mode" value={details.mode} />
              )}
              {details.agentCount > 0 && (
                <DetailRow
                  label="Agents"
                  value={`${details.agentCount} configured`}
                />
              )}
              {details.channelCount > 0 && (
                <DetailRow
                  label="Channels"
                  value={`${details.activeChannels} / ${details.channelCount} active`}
                />
              )}
            </div>
          )}

          {/* Error info */}
          {!!health?.error && (
            <div className="border-t border-foreground/[0.06] px-3.5 py-2.5">
              <p className="text-[10px] leading-relaxed text-red-400">
                {String(health.error)}
              </p>
            </div>
          )}

          {/* Footer hint */}
          <div className="border-t border-foreground/[0.06] px-3.5 py-2">
            <p className="text-[10px] text-muted-foreground/50">
              Polling every 12s · Click Pause above to stop gateway
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted-foreground/60">{label}</span>
      <span className="text-[11px] font-medium text-foreground/70">{value}</span>
    </div>
  );
}

/* ── Header ─────────────────────────────────────── */

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { paused, busy: pauseBusy, toggle: togglePause } = usePauseState();
  const { status: gwStatus, health: gwHealth } = useGatewayStatus();

  // Global Cmd+K / Ctrl+K shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-sidebar/80 px-3 md:px-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 pl-10 md:pl-0">
          <span className="text-lg">🦞</span>
          <h1 className="text-sm font-semibold text-foreground">
            Mission Control
          </h1>
          <GatewayStatusBadge status={gwStatus} health={gwHealth} />
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* ── Actions ── */}

          {/* Quick Command (primary CTA) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCmdOpen(!cmdOpen)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-2 md:px-3 text-xs transition-colors",
                cmdOpen
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-foreground/[0.08] bg-card text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Ping Agent</span>
            </button>

            {cmdOpen && (
              <QuickCommandPopover onClose={() => setCmdOpen(false)} />
            )}
          </div>

          {/* Search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-8 items-center gap-2 rounded-lg border border-foreground/[0.08] bg-card px-2 md:px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground/70"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-1 hidden rounded border border-foreground/[0.08] bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </button>

          {/* ── divider ── */}
          <div className="hidden h-5 w-px bg-foreground/[0.08] sm:block" />

          {/* ── System controls ── */}

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={togglePause}
            disabled={pauseBusy}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-2 md:px-3 text-xs transition-colors disabled:opacity-50",
              paused
                ? "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "border-foreground/[0.08] bg-card text-muted-foreground hover:bg-muted/80"
            )}
          >
            {paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
          </button>

          {/* Pairing Notifications */}
          <PairingNotifications />

          {/* ── divider ── */}
          <div className="hidden h-5 w-px bg-foreground/[0.08] sm:block" />

          {/* ── Settings ── */}

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </header>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
