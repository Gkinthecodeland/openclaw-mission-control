"use client";

export const dynamic = "force-dynamic";

import dynamic_ from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { ChatView } from "@/components/chat-view";
import { OpenClawUpdateBanner } from "@/components/openclaw-update-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { setChatActive } from "@/lib/chat-store";
import { Loader2 } from "lucide-react";

/* ── Lightweight views (always bundled) ───────────── */
import { TasksView } from "@/components/tasks-view";
import { CronView } from "@/components/cron-view";
import { SessionsView } from "@/components/sessions-view";
import { ChannelsView } from "@/components/channels-view";
import { MemoryView } from "@/components/memory-view";
import { DocsView } from "@/components/docs-view";
import { SkillsView } from "@/components/skills-view";
import { LogsView } from "@/components/logs-view";
import { ModelsView } from "@/components/models-view";
import { AudioView } from "@/components/audio-view";
import { UsageView } from "@/components/usage-view";
import { PermissionsView } from "@/components/permissions-view";
import { TailscaleView } from "@/components/tailscale-view";
import { BrowserRelayView } from "@/components/browser-relay-view";
import { AccountsKeysView } from "@/components/accounts-keys-view";
import { CalendarView } from "@/components/calendar-view";
import { WebSearchView } from "@/components/web-search-view";

/* ── Heavy views (lazy loaded — Monaco ~2MB, xterm, ReactFlow) ── */
const ConfigEditor = dynamic_(
  () => import("@/components/config-editor").then((m) => m.ConfigEditor),
  { loading: () => <SectionLoader label="Config Editor" />, ssr: false }
);
const TerminalView = dynamic_(
  () => import("@/components/terminal-view").then((m) => m.TerminalView),
  { loading: () => <SectionLoader label="Terminal" />, ssr: false }
);
const AgentsView = dynamic_(
  () => import("@/components/agents-view").then((m) => m.AgentsView),
  { loading: () => <SectionLoader label="Agents" />, ssr: false }
);
const VectorView = dynamic_(
  () => import("@/components/vector-view").then((m) => m.VectorView),
  { loading: () => <SectionLoader label="Vector DB" />, ssr: false }
);

/* ── Loading fallback ───────────────────────────────── */
function SectionLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground/60">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading {label}...
    </div>
  );
}

/* ── Section content with error boundary per view ──── */
function SectionContent({ section }: { section: string }) {
  const content = (() => {
    switch (section) {
      case "dashboard":
        return <DashboardView />;
      case "agents":
        return <AgentsView />;
      case "tasks":
        return <TasksView />;
      case "cron":
        return <CronView />;
      case "sessions":
        return <SessionsView />;
      case "channels":
      case "system":
        return <ChannelsView />;
      case "memory":
        return <MemoryView />;
      case "docs":
        return <DocsView />;
      case "config":
        return <ConfigEditor />;
      case "skills":
        return <SkillsView />;
      case "models":
        return <ModelsView />;
      case "accounts":
        return <AccountsKeysView />;
      case "audio":
        return <AudioView />;
      case "vectors":
        return <VectorView />;
      case "logs":
        return <LogsView />;
      case "usage":
        return <UsageView />;
      case "terminal":
        return <TerminalView />;
      case "permissions":
        return <PermissionsView />;
      case "tailscale":
        return <TailscaleView />;
      case "browser":
        return <BrowserRelayView />;
      case "calendar":
        return <CalendarView />;
      case "search":
        return <WebSearchView />;
      default:
        return <DashboardView />;
    }
  })();

  return (
    <ErrorBoundary section={section} key={section}>
      {content}
    </ErrorBoundary>
  );
}

/* ── Main content with section transition ──────────── */
function MainContent() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || "dashboard";
  const isChatSection = section === "chat";
  const prevSection = useRef(section);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track chat tab visibility for notification system
  useEffect(() => {
    setChatActive(isChatSection);
    return () => setChatActive(false);
  }, [isChatSection]);

  // Section transition animation
  useEffect(() => {
    if (prevSection.current !== section && containerRef.current) {
      const el = containerRef.current;
      el.style.opacity = "0";
      el.style.transform = "translateY(4px)";
      requestAnimationFrame(() => {
        el.style.transition = "opacity 150ms ease-out, transform 150ms ease-out";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    }
    prevSection.current = section;
  }, [section]);

  return (
    <>
      {/* ChatView is ALWAYS mounted so chat state persists across tab switches. */}
      <div
        className={isChatSection ? "flex flex-1 flex-col overflow-hidden" : "hidden"}
      >
        <ChatView isVisible={isChatSection} />
      </div>

      {/* All other views: update banner + section content */}
      {!isChatSection && (
        <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
          <OpenClawUpdateBanner />
          <SectionContent section={section} />
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground/60">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </div>
      }
    >
      <MainContent />
    </Suspense>
  );
}
