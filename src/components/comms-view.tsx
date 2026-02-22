"use client";

import { useState } from "react";
import { SectionLayout, SectionHeader, SectionBody } from "@/components/section-layout";
import { CrTabBar } from "@/components/cr-tab-bar";
import { GlassCard } from "@/components/glass-card";
import { StaggerGrid } from "@/components/stagger-grid";
import { KanbanBoard } from "@/components/kanban-board";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { COMMS_TABS } from "@/lib/cr-constants";
import type { CrCommsDigest, CrContact } from "@/lib/cr-types";
import { MessageSquare, Send } from "lucide-react";

const FALLBACK_DIGESTS: CrCommsDigest[] = [
  { channel: "discord", messages: 45, lastActivity: "5m ago", highlights: ["Build monitor report completed", "Test suite all green", "New PR merged"] },
  { channel: "telegram", messages: 23, lastActivity: "10m ago", highlights: ["Server status check", "Task approval request", "Daily briefing sent"] },
];

const FALLBACK_CONTACTS: (CrContact & { column: string })[] = [
  { id: "1", name: "Metro AG", company: "Metro", type: "client", stage: "won", value: 45000, tags: ["wholesale"], column: "won" },
  { id: "2", name: "Lidl Hellas", company: "Lidl", type: "lead", stage: "contacted", value: 120000, tags: ["retail", "national"], column: "contacted" },
  { id: "3", name: "AB Vassilopoulos", company: "AB", type: "lead", stage: "prospect", value: 80000, tags: ["retail"], column: "prospect" },
  { id: "4", name: "Masoutis", company: "Masoutis", type: "lead", stage: "negotiation", value: 65000, tags: ["retail", "northern-greece"], column: "negotiation" },
];

const CRM_COLUMNS = [
  { id: "prospect", title: "Prospect", color: "#6b7280" },
  { id: "contacted", title: "Contacted", color: "#3b82f6" },
  { id: "negotiation", title: "Negotiation", color: "#f59e0b" },
  { id: "won", title: "Won", color: "#10b981" },
  { id: "lost", title: "Lost", color: "#ef4444" },
];

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  discord: <MessageSquare className="h-5 w-5 text-indigo-400" />,
  telegram: <Send className="h-5 w-5 text-sky-400" />,
};

const CHANNEL_COLORS: Record<string, string> = {
  discord: "text-indigo-400",
  telegram: "text-sky-400",
};

export function CommsView() {
  const [activeTab, setActiveTab] = useState("comms");

  const { data: digestData } = useWorkspaceApi<{ digests: CrCommsDigest[] }>("/api/comms");
  const { data: clientData } = useWorkspaceApi<{ contacts: CrContact[] }>("/api/clients");

  const digests = digestData?.digests ?? FALLBACK_DIGESTS;
  const contacts: (CrContact & { column: string })[] = clientData?.contacts
    ? clientData.contacts.map((c) => ({ ...c, column: c.stage }))
    : FALLBACK_CONTACTS;

  return (
    <SectionLayout>
      <SectionHeader
        title="Comms"
        description="Discord & Telegram digest, CRM pipeline"
        actions={
          <CrTabBar
            tabs={COMMS_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            layoutId="comms-tabs"
          />
        }
      />
      <SectionBody width="full" padding="regular">
        {activeTab === "comms" && (
          <StaggerGrid columns="grid-cols-1 sm:grid-cols-2">
            {digests.map((digest) => (
              <GlassCard key={digest.channel}>
                <div className="flex items-center gap-3 mb-4">
                  {CHANNEL_ICONS[digest.channel]}
                  <div>
                    <h3 className={`text-base font-semibold capitalize ${CHANNEL_COLORS[digest.channel]}`}>
                      {digest.channel}
                    </h3>
                    <p className="text-xs text-mc-text-muted">
                      {digest.messages} messages · {digest.lastActivity}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {digest.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-mc-text-secondary">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-mc-accent flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </StaggerGrid>
        )}

        {activeTab === "crm" && (
          <KanbanBoard
            columns={CRM_COLUMNS}
            items={contacts}
            renderItem={(contact) => (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-mc-text-primary">{contact.name}</p>
                {contact.company && (
                  <p className="text-xs text-mc-text-muted">{contact.company}</p>
                )}
                {contact.value !== undefined && (
                  <p className="text-xs font-mono text-mc-accent">
                    €{contact.value.toLocaleString()}
                  </p>
                )}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded px-1.5 py-0.5 text-xs text-mc-text-muted bg-mc-bg-surface"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          />
        )}
      </SectionBody>
    </SectionLayout>
  );
}
