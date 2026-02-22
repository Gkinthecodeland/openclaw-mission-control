import { GlassCard } from "./glass-card";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, change, changeLabel, icon }: MetricCardProps) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-mc-text-muted">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-mc-text-primary">
            {value}
          </p>
          {change !== undefined && (
            <div className="mt-1 flex items-center gap-1">
              {change > 0 ? (
                <TrendingUp className="h-3 w-3 text-mc-status-ok" />
              ) : change < 0 ? (
                <TrendingDown className="h-3 w-3 text-mc-status-error" />
              ) : (
                <Minus className="h-3 w-3 text-mc-text-muted" />
              )}
              <span
                className={cn(
                  "text-xs",
                  change > 0
                    ? "text-mc-status-ok"
                    : change < 0
                    ? "text-mc-status-error"
                    : "text-mc-text-muted"
                )}
              >
                {change > 0 ? "+" : ""}
                {change}% {changeLabel}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mc-accent/10 text-mc-accent">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
