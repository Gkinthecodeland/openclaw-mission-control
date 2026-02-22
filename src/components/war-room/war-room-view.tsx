"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus,
  X,
  Bot,
  Zap,
  Radio,
  UserPlus,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Trash2,
  Moon,
  PanelLeft,
  PanelRight,
  Send,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLayout } from "@/components/section-layout";
import type {
  WarRoomTask,
  Column,
  KanbanData,
  AgentInfo,
  ActivityEvent,
} from "@/types/warroom";

/* ── Constants ───────────────────────────────────── */

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

const COLUMN_DOT: Record<string, string> = {
  backlog: "bg-zinc-400",
  "in-progress": "bg-violet-500 animate-pulse",
  review: "bg-amber-400",
  done: "bg-emerald-400",
};

/* ── Helpers ─────────────────────────────────────── */

function timeAgo(ms: number | undefined): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getAgentStatus(agent: AgentInfo): "active" | "idle" | "unknown" {
  if (agent.status) return agent.status;
  if (!agent.lastActivity) return "unknown";
  return Date.now() - agent.lastActivity < 300000 ? "active" : "idle";
}

/* ── Main Component ──────────────────────────────── */

export function WarRoomView() {
  // Data
  const [kanban, setKanban] = useState<KanbanData | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [squadCollapsed, setSquadCollapsed] = useState(false);
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [filteredAgentId, setFilteredAgentId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverAgent, setDragOverAgent] = useState<string | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<"all" | "tasks" | "agents">("all");

  const streamRef = useRef<EventSource | null>(null);

  /* ── Data fetching ─────────────────────────────── */

  const fetchKanban = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setKanban(data);
    } catch { /* retry next time */ }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.agents || [];
      setAgents(
        list.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: (a.name as string) || (a.id as string),
          emoji: (a.emoji as string) || "🤖",
          model: a.model as string,
          sessionCount: (a.sessionCount as number) || 0,
          totalTokens: (a.totalTokens as number) || 0,
          lastActivity: a.lastActivity as number,
          status: a.status as "active" | "idle" | "unknown" | undefined,
        }))
      );
    } catch { /* ignore */ }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([fetchKanban(), fetchAgents()]).then(() => setLoading(false));
  }, [fetchKanban, fetchAgents]);

  // Agent polling (every 10s)
  useEffect(() => {
    const id = setInterval(fetchAgents, 10000);
    return () => clearInterval(id);
  }, [fetchAgents]);

  // SSE stream
  useEffect(() => {
    const es = new EventSource("/api/warroom/stream");
    streamRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "kanban-updated") {
          fetchKanban();
        } else if (event.type === "task-moved" || event.type === "task-assigned" || event.type === "task-updated") {
          fetchKanban();
          // Add to activity feed
          setActivity((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
              actor: event.agentId || "system",
              action: event.type.replace("task-", "task."),
              taskId: event.taskId,
              fromColumn: event.fromColumn,
              toColumn: event.toColumn,
            },
            ...prev.slice(0, 99),
          ]);
        } else if (event.type === "agent-status") {
          setAgents((prev) =>
            prev.map((a) =>
              a.id === event.agentId ? { ...a, status: event.status } : a
            )
          );
        }
      } catch { /* ignore */ }
    };

    return () => {
      es.close();
      streamRef.current = null;
    };
  }, [fetchKanban]);

  /* ── Task mutations ────────────────────────────── */

  const patchTask = useCallback(
    async (taskId: number, changes: Partial<WarRoomTask>) => {
      // Optimistic update
      setKanban((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, ...changes } : t
          ),
        };
      });

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        if (!res.ok) {
          // Revert on error
          fetchKanban();
        }
      } catch {
        fetchKanban();
      }
    },
    [fetchKanban]
  );

  const addTask = useCallback(
    async (task: Omit<WarRoomTask, "id">) => {
      if (!kanban) return;
      const maxId = kanban.tasks.reduce((m, t) => Math.max(m, t.id), 0);
      const newTask = { ...task, id: maxId + 1, createdAt: Date.now(), updatedAt: Date.now() };
      const newData = { ...kanban, tasks: [...kanban.tasks, newTask] };
      setKanban(newData);

      try {
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newData),
        });
      } catch {
        fetchKanban();
      }
    },
    [kanban, fetchKanban]
  );

  const deleteTask = useCallback(
    async (taskId: number) => {
      if (!kanban) return;
      const newData = { ...kanban, tasks: kanban.tasks.filter((t) => t.id !== taskId) };
      setKanban(newData);

      try {
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newData),
        });
      } catch {
        fetchKanban();
      }
    },
    [kanban, fetchKanban]
  );

  /* ── Drag handlers ─────────────────────────────── */

  const handleDrop = useCallback(
    (columnId: string, e: React.DragEvent) => {
      e.preventDefault();
      const taskId = Number(e.dataTransfer.getData("text/plain"));
      if (taskId && !isNaN(taskId)) {
        patchTask(taskId, { column: columnId });
        setActivity((prev) => [
          {
            id: `${Date.now()}-move`,
            timestamp: Date.now(),
            actor: "human",
            action: "task.moved",
            taskId,
            toColumn: columnId,
          },
          ...prev.slice(0, 99),
        ]);
      }
      setDraggingTaskId(null);
      setDragOverColumn(null);
    },
    [patchTask]
  );

  const handleAgentDrop = useCallback(
    (agentId: string, e: React.DragEvent) => {
      e.preventDefault();
      const taskId = Number(e.dataTransfer.getData("text/plain"));
      if (taskId && !isNaN(taskId)) {
        patchTask(taskId, { assignedAgent: agentId });
        setActivity((prev) => [
          {
            id: `${Date.now()}-assign`,
            timestamp: Date.now(),
            actor: "human",
            action: "task.assigned",
            taskId,
            agentId,
          },
          ...prev.slice(0, 99),
        ]);
      }
      setDraggingTaskId(null);
      setDragOverAgent(null);
    },
    [patchTask]
  );

  /* ── Loading state ─────────────────────────────── */

  if (loading || !kanban) {
    return (
      <SectionLayout>
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground/60">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-violet-500" />
          Loading War Room...
        </div>
      </SectionLayout>
    );
  }

  const { columns, tasks } = kanban;
  const activeAgents = agents.filter((a) => getAgentStatus(a) === "active").length;
  const queueCount = tasks.filter((t) => t.column !== "done").length;

  /* ── Render ────────────────────────────────────── */

  return (
    <SectionLayout>
      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10 bg-card/80 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-sm tracking-tight">War Room</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", activeAgents > 0 ? "bg-emerald-400 animate-pulse" : "bg-zinc-400")} />
            {activeAgents} ACTIVE
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {queueCount} in queue
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSquadCollapsed(!squadCollapsed)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !squadCollapsed && "bg-muted/50"
            )}
            title="Toggle squad panel"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFeedCollapsed(!feedCollapsed)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !feedCollapsed && "bg-muted/50"
            )}
            title="Toggle live feed"
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── 3-panel layout ───────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Squad Panel (left) ──────────────── */}
        <div
          className={cn(
            "shrink-0 border-r border-foreground/10 bg-card/50 overflow-y-auto transition-[width] duration-200 ease-in-out",
            squadCollapsed ? "w-0 overflow-hidden" : "w-60"
          )}
        >
          <div className="p-3 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Squad ({agents.length})
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {activeAgents}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {agents.length - activeAgents}
                </span>
              </div>
            </div>

            {agents.map((agent) => {
              const status = getAgentStatus(agent);
              const agentTaskCount = tasks.filter((t) => t.assignedAgent === agent.id && t.column !== "done").length;
              const isFiltered = filteredAgentId === agent.id;
              const isDragTarget = dragOverAgent === agent.id;

              return (
                <button
                  key={agent.id}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all",
                    "hover:bg-muted",
                    isFiltered && "bg-violet-500/10 ring-1 ring-violet-500/30",
                    isDragTarget && "bg-violet-500/15 ring-1 ring-violet-500/40"
                  )}
                  onClick={() => setFilteredAgentId(isFiltered ? null : agent.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "link";
                    setDragOverAgent(agent.id);
                  }}
                  onDragLeave={() => setDragOverAgent(null)}
                  onDrop={(e) => handleAgentDrop(agent.id, e)}
                >
                  {/* Avatar + status */}
                  <div className="relative shrink-0">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-sm">
                      {agent.emoji || "🤖"}
                    </div>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                        status === "active" ? "bg-emerald-400" : status === "idle" ? "bg-amber-400" : "bg-zinc-500"
                      )}
                    />
                  </div>
                  {/* Name + info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block capitalize">{agent.name || agent.id}</span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {status === "active" ? "Working" : status === "idle" ? "Idle" : "Unknown"}
                      {agentTaskCount > 0 && ` · ${agentTaskCount} task${agentTaskCount > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  {/* Workload indicator */}
                  <div className="shrink-0 w-6 text-right">
                    <span className="text-[10px] text-muted-foreground/60">{agentTaskCount}</span>
                  </div>
                </button>
              );
            })}

            {agents.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Bot className="h-5 w-5 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground/50">No agents found</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Kanban Board (center) ──────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter indicator */}
          {filteredAgentId && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-violet-500/5 border-b border-violet-500/20 text-xs">
              <span className="text-violet-400">
                Filtering: {agents.find((a) => a.id === filteredAgentId)?.name || filteredAgentId}
              </span>
              <button
                type="button"
                onClick={() => setFilteredAgentId(null)}
                className="rounded p-0.5 hover:bg-violet-500/10 text-violet-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="flex flex-1 gap-3 overflow-x-auto p-4">
            {columns.map((col) => {
              let colTasks = tasks.filter((t) => t.column === col.id);
              if (filteredAgentId) {
                colTasks = colTasks.filter((t) => t.assignedAgent === filteredAgentId);
              }
              const isDragTarget = dragOverColumn === col.id && draggingTaskId !== null;

              return (
                <div
                  key={col.id}
                  className={cn(
                    "flex min-w-72 flex-1 flex-col rounded-xl border border-foreground/5 bg-muted/30 p-3 transition-all",
                    isDragTarget && "bg-violet-500/10 border-violet-500/20 ring-1 ring-inset ring-violet-500/20"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverColumn !== col.id) setDragOverColumn(col.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverColumn(null);
                    }
                  }}
                  onDrop={(e) => handleDrop(col.id, e)}
                >
                  {/* Column header */}
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <span className={cn("h-2.5 w-2.5 rounded-full", COLUMN_DOT[col.id] || "bg-zinc-400")} />
                    <span className="text-sm font-semibold text-foreground/80">{col.title}</span>
                    <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs font-medium text-muted-foreground min-w-[1.5rem] text-center">
                      {colTasks.length}
                    </span>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setAddingToColumn(addingToColumn === col.id ? null : col.id)}
                      className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground/70 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Inline add form */}
                  {addingToColumn === col.id && (
                    <InlineAddTask
                      column={col.id}
                      agents={agents}
                      onAdd={(task) => { addTask(task); setAddingToColumn(null); }}
                      onCancel={() => setAddingToColumn(null)}
                    />
                  )}

                  {/* Task cards */}
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                    {colTasks.length === 0 && addingToColumn !== col.id ? (
                      <div className={cn(
                        "flex items-center justify-center rounded-lg border border-dashed py-8 text-xs transition-colors",
                        isDragTarget
                          ? "border-violet-500/30 text-violet-400/60 bg-violet-500/5"
                          : "border-foreground/10 text-muted-foreground/60"
                      )}>
                        {isDragTarget ? "Drop here" : "No tasks"}
                      </div>
                    ) : (
                      colTasks.map((task) => {
                        const agent = agents.find((a) => a.id === task.assignedAgent);
                        const isDimmed = filteredAgentId && task.assignedAgent !== filteredAgentId;

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", String(task.id));
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingTaskId(task.id);
                            }}
                            onDragEnd={() => {
                              setDraggingTaskId(null);
                              setDragOverColumn(null);
                              setDragOverAgent(null);
                            }}
                            className={cn(
                              "rounded-xl border border-foreground/10 bg-card p-3 cursor-grab active:cursor-grabbing",
                              "hover:shadow-md transition-all group relative",
                              draggingTaskId === task.id && "opacity-40 scale-95",
                              isDimmed && "opacity-30",
                              task.priority === "critical" && "glow-critical",
                              task.priority === "high" && "glow-warning",
                              col.id === "in-progress" && task.priority !== "critical" && task.priority !== "high" && "glow-active"
                            )}
                          >
                            {/* Priority dot */}
                            <div className="flex items-start gap-2">
                              <div className={cn("mt-1 h-2 w-2 rounded-full shrink-0", PRIORITY_COLORS[task.priority] || "bg-zinc-400")} />
                              <div className="flex-1 min-w-0">
                                {/* Urgency badge */}
                                {task.urgency === "immediate" && (
                                  <span className="inline-block mb-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400">
                                    Urgent
                                  </span>
                                )}
                                <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
                                {task.description && (
                                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                                )}
                              </div>
                            </div>

                            {/* Tags */}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {task.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Footer: assignee + time */}
                            <div className="flex items-center justify-between mt-2.5">
                              <div className="flex items-center gap-1.5">
                                {agent ? (
                                  <>
                                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-[11px]">
                                      {agent.emoji || "🤖"}
                                    </div>
                                    <span className="text-xs text-muted-foreground capitalize">{agent.name || agent.id}</span>
                                  </>
                                ) : task.assignee ? (
                                  <span className="text-xs text-muted-foreground">{task.assignee}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground/40">Unassigned</span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground/50">{timeAgo(task.updatedAt || task.createdAt)}</span>
                            </div>

                            {/* Hover actions */}
                            <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                className="rounded p-1 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Live Feed (right) ──────────────── */}
        <div
          className={cn(
            "shrink-0 border-l border-foreground/10 bg-card/50 flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden",
            feedCollapsed ? "w-0" : "w-80"
          )}
        >
          {/* Feed header */}
          <div className="px-3 py-2 border-b border-foreground/10 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Radio className="h-3 w-3" />
                Live Feed
              </h3>
            </div>
            <div className="flex gap-1">
              {(["all", "tasks", "agents"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFeedFilter(tab)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium transition-colors capitalize",
                    feedFilter === tab
                      ? "bg-violet-500/20 text-violet-300"
                      : "text-muted-foreground/60 hover:text-foreground/70"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Feed events */}
          <div className="flex-1 overflow-y-auto">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center px-4">
                <Radio className="h-5 w-5 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/40">Activity will appear here</p>
                <p className="text-xs text-muted-foreground/30">Move tasks, assign agents, or wait for agent updates</p>
              </div>
            ) : (
              activity
                .filter((evt) => {
                  if (feedFilter === "all") return true;
                  if (feedFilter === "tasks") return evt.action.startsWith("task.");
                  if (feedFilter === "agents") return evt.action.startsWith("agent.");
                  return true;
                })
                .map((evt) => {
                  const evtAgent = agents.find((a) => a.id === evt.actor);
                  const evtTask = tasks.find((t) => t.id === evt.taskId);
                  const { icon: Icon, color } = getEventDisplay(evt.action);

                  return (
                    <div
                      key={evt.id}
                      className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground/90 leading-relaxed">
                          <span className="font-medium capitalize">{evtAgent?.name || evt.actor}</span>
                          {" "}
                          {formatAction(evt.action)}
                          {evtTask && (
                            <span className="text-muted-foreground"> &ldquo;{evtTask.title}&rdquo;</span>
                          )}
                          {evt.toColumn && (
                            <span className="text-muted-foreground"> → {evt.toColumn}</span>
                          )}
                        </p>
                        <span className="text-[11px] text-muted-foreground/50">{timeAgo(evt.timestamp)}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

/* ── Inline Add Task ─────────────────────────────── */

function InlineAddTask({
  column,
  agents,
  onAdd,
  onCancel,
}: {
  column: string;
  agents: AgentInfo[];
  onAdd: (task: Omit<WarRoomTask, "id">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedAgent, setAssignedAgent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      column,
      priority,
      assignedAgent: assignedAgent || undefined,
    });
  };

  return (
    <div className="mb-2 rounded-lg border border-violet-500/20 bg-card p-2.5 space-y-2">
      <input
        ref={inputRef}
        type="text"
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded bg-foreground/5 px-1.5 py-0.5 text-xs text-muted-foreground outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {agents.length > 0 && (
          <select
            value={assignedAgent}
            onChange={(e) => setAssignedAgent(e.target.value)}
            className="rounded bg-foreground/5 px-1.5 py-0.5 text-xs text-muted-foreground outline-none"
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.name || a.id}
              </option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="rounded bg-violet-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/* ── Feed event display helpers ──────────────────── */

function getEventDisplay(action: string): { icon: typeof Zap; color: string } {
  switch (action) {
    case "task.moved":
      return { icon: ArrowRight, color: "text-blue-400" };
    case "task.assigned":
      return { icon: UserPlus, color: "text-violet-400" };
    case "task.completed":
      return { icon: CheckCircle, color: "text-emerald-400" };
    case "task.created":
      return { icon: Plus, color: "text-zinc-400" };
    case "agent.online":
    case "agent.active":
      return { icon: Zap, color: "text-emerald-400" };
    case "agent.idle":
      return { icon: Moon, color: "text-amber-400" };
    default:
      return { icon: Radio, color: "text-muted-foreground/60" };
  }
}

function formatAction(action: string): string {
  switch (action) {
    case "task.moved": return "moved task";
    case "task.assigned": return "was assigned";
    case "task.completed": return "completed";
    case "task.created": return "created task";
    case "task.updated": return "updated task";
    case "agent.online": return "came online";
    case "agent.idle": return "went idle";
    default: return action.replace(/\./g, " ");
  }
}
