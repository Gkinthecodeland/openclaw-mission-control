import { cn } from "@/lib/utils";

type CrStatusType =
  | "online"
  | "offline"
  | "degraded"
  | "idle"
  | "active"
  | "paused"
  | "error"
  | "standby"
  | "disabled";

const STATUS_STYLES: Record<CrStatusType, { dot: string; text: string; bg: string }> = {
  online: { dot: "bg-mc-status-ok", text: "text-mc-status-ok", bg: "bg-mc-status-ok/10" },
  active: { dot: "bg-mc-status-ok", text: "text-mc-status-ok", bg: "bg-mc-status-ok/10" },
  degraded: { dot: "bg-mc-status-warn", text: "text-mc-status-warn", bg: "bg-mc-status-warn/10" },
  paused: { dot: "bg-mc-status-warn", text: "text-mc-status-warn", bg: "bg-mc-status-warn/10" },
  offline: { dot: "bg-mc-status-error", text: "text-mc-status-error", bg: "bg-mc-status-error/10" },
  error: { dot: "bg-mc-status-error", text: "text-mc-status-error", bg: "bg-mc-status-error/10" },
  idle: { dot: "bg-mc-text-muted", text: "text-mc-text-muted", bg: "bg-mc-text-muted/10" },
  standby: { dot: "bg-mc-text-muted", text: "text-mc-text-muted", bg: "bg-mc-text-muted/10" },
  disabled: { dot: "bg-mc-text-muted", text: "text-mc-text-muted", bg: "bg-mc-text-muted/10" },
};

interface CrStatusBadgeProps {
  status: CrStatusType;
  label?: string;
  className?: string;
  pulse?: boolean;
}

export function CrStatusBadge({ status, label, className, pulse = false }: CrStatusBadgeProps) {
  const styles = STATUS_STYLES[status] || STATUS_STYLES.idle;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles.bg,
        styles.text,
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          styles.dot,
          pulse && "animate-pulse"
        )}
      />
      {label || status}
    </span>
  );
}
