"use client";

import { cn } from "@/lib/utils";
import { GlassCard } from "./glass-card";
import type { ReactNode } from "react";

interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
}

interface KanbanItem {
  id: string;
  column: string;
}

interface KanbanBoardProps<T extends KanbanItem> {
  columns: KanbanColumn[];
  items: T[];
  renderItem: (item: T) => ReactNode;
  className?: string;
}

export function KanbanBoard<T extends KanbanItem>({
  columns,
  items,
  renderItem,
  className,
}: KanbanBoardProps<T>) {
  return (
    <div className={cn("flex gap-4 overflow-x-auto pb-4", className)}>
      {columns.map((col) => {
        const columnItems = items.filter((item) => item.column === col.id);
        return (
          <div
            key={col.id}
            className="flex min-w-[280px] flex-1 flex-col gap-2"
          >
            <div className="flex items-center gap-2 px-1 py-2">
              {col.color && (
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
              )}
              <h3 className="text-xs font-medium uppercase tracking-wider text-mc-text-muted">
                {col.title}
              </h3>
              <span className="text-xs text-mc-text-muted">
                {columnItems.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {columnItems.map((item) => (
                <GlassCard key={item.id} hover className="p-3">
                  {renderItem(item)}
                </GlassCard>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
