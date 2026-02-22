/* ── War Room types ──────────────────────────────── */

export type Priority = "critical" | "high" | "medium" | "low";
export type Urgency = "immediate" | "today" | "this-week" | "backlog";

export type WarRoomTask = {
  id: number;
  title: string;
  description?: string;
  column: string;
  priority: string;
  assignee?: string;
  attachments?: string[];
  // War Room extensions (all optional — backward compatible)
  assignedAgent?: string;
  urgency?: Urgency;
  tags?: string[];
  dueDate?: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  completedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  sessionId?: string;
};

export type Column = { id: string; title: string; color: string };

export type KanbanData = {
  columns: Column[];
  tasks: WarRoomTask[];
  _fileExists?: boolean;
};

export type AgentInfo = {
  id: string;
  name?: string;
  emoji?: string;
  model?: string;
  sessionCount?: number;
  totalTokens?: number;
  lastActivity?: number;
  status?: "active" | "idle" | "unknown";
};

export type ActivityEvent = {
  id: string;
  timestamp: number;
  actor: string; // "human" | agent ID
  action: string;
  taskId?: number;
  agentId?: string;
  fromColumn?: string;
  toColumn?: string;
  meta?: Record<string, unknown>;
};

export type WarRoomEvent =
  | { type: "task-updated"; taskId: number; changes: Partial<WarRoomTask> }
  | { type: "task-moved"; taskId: number; fromColumn: string; toColumn: string }
  | { type: "task-assigned"; taskId: number; agentId: string }
  | { type: "agent-status"; agentId: string; status: string; name?: string; emoji?: string }
  | { type: "activity"; event: ActivityEvent }
  | { type: "kanban-updated" }
  | { type: "ping" };
