import type { CrTabItem } from "./cr-types";

export const COMMS_TABS: CrTabItem[] = [
  { id: "comms", label: "Comms", icon: "Radio" },
  { id: "crm", label: "CRM", icon: "Users" },
];

export const KNOWLEDGE_TABS: CrTabItem[] = [
  { id: "knowledge", label: "Knowledge", icon: "BookOpen" },
  { id: "ecosystem", label: "Ecosystem", icon: "Globe" },
];

export const CONTENT_STATUSES = [
  "idea",
  "drafting",
  "review",
  "scheduled",
  "published",
] as const;

export const CRM_STAGES = [
  "prospect",
  "contacted",
  "negotiation",
  "won",
  "lost",
] as const;

export const CR_STATUS_COLORS = {
  online: "bg-mc-status-ok",
  degraded: "bg-mc-status-warn",
  offline: "bg-mc-status-error",
  idle: "bg-mc-text-muted",
  active: "bg-mc-status-ok",
  paused: "bg-mc-status-warn",
  error: "bg-mc-status-error",
  standby: "bg-mc-text-muted",
  disabled: "bg-mc-text-muted",
} as const;

export const CR_PRIORITY_COLORS = {
  high: "text-mc-status-error",
  medium: "text-mc-status-warn",
  low: "text-mc-text-secondary",
} as const;

export const WORKSPACE_PATH =
  process.env.WORKSPACE_PATH || "~/.openclaw/workspace";
