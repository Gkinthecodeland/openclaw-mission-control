"use client";

import { SectionLayout, SectionHeader, SectionBody } from "@/components/section-layout";
import { KanbanBoard } from "@/components/kanban-board";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { CrContentItem } from "@/lib/cr-types";
import { cn } from "@/lib/utils";

const FALLBACK_ITEMS: (CrContentItem & { column: string })[] = [
  { id: "1", title: "OpenClaw Launch Announcement", type: "blog", status: "idea", author: "GK", tags: ["openclaw", "launch"], createdAt: new Date().toISOString(), column: "idea" },
  { id: "2", title: "Donna AI Thread", type: "social", status: "drafting", author: "Donna", tags: ["twitter", "ai"], createdAt: new Date().toISOString(), column: "drafting" },
  { id: "3", title: "Weekly Builder Update", type: "email", status: "review", author: "GK", tags: ["newsletter"], createdAt: new Date().toISOString(), column: "review" },
  { id: "4", title: "Mission Control Demo Video", type: "video", status: "scheduled", author: "GK", tags: ["demo"], createdAt: new Date().toISOString(), column: "scheduled" },
  { id: "5", title: "Agent Framework Comparison", type: "doc", status: "published", author: "Donna", tags: ["research"], createdAt: new Date().toISOString(), column: "published" },
];

const COLUMNS = [
  { id: "idea", title: "Idea", color: "#6b7280" },
  { id: "drafting", title: "Drafting", color: "#3b82f6" },
  { id: "review", title: "Review", color: "#f59e0b" },
  { id: "scheduled", title: "Scheduled", color: "#06b6d4" },
  { id: "published", title: "Published", color: "#10b981" },
];

const TYPE_COLORS: Record<string, string> = {
  blog: "bg-blue-500/20 text-blue-300",
  social: "bg-purple-500/20 text-purple-300",
  email: "bg-amber-500/20 text-amber-300",
  video: "bg-red-500/20 text-red-300",
  doc: "bg-emerald-500/20 text-emerald-300",
};

export function ContentView() {
  const { data } = useWorkspaceApi<{ items: CrContentItem[] }>("/api/content-pipeline");

  const items: (CrContentItem & { column: string })[] = data?.items
    ? data.items.map((item) => ({ ...item, column: item.status }))
    : FALLBACK_ITEMS;

  return (
    <SectionLayout>
      <SectionHeader
        title="Content"
        description="Content pipeline and publishing workflow"
      />
      <SectionBody width="full" padding="regular">
        <KanbanBoard
          columns={COLUMNS}
          items={items}
          renderItem={(item) => (
            <div className="space-y-2">
              <p className="text-sm font-medium text-mc-text-primary leading-snug">
                {item.title}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-medium",
                    TYPE_COLORS[item.type] ?? "bg-mc-bg-surface text-mc-text-muted"
                  )}
                >
                  {item.type}
                </span>
                {item.author && (
                  <span className="text-xs text-mc-text-muted">{item.author}</span>
                )}
              </div>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded px-1.5 py-0.5 text-xs text-mc-text-muted bg-mc-bg-surface"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        />
      </SectionBody>
    </SectionLayout>
  );
}
