"use client";

import { useState } from "react";
import { SectionLayout, SectionHeader, SectionBody } from "@/components/section-layout";
import { CrTabBar } from "@/components/cr-tab-bar";
import { GlassCard } from "@/components/glass-card";
import { StaggerGrid } from "@/components/stagger-grid";
import { CrStatusBadge } from "@/components/cr-status-badge";
import { MetricCard } from "@/components/metric-card";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { KNOWLEDGE_TABS } from "@/lib/cr-constants";
import { truncate } from "@/lib/utils";
import type { CrKnowledgeFile, CrEcosystemProduct } from "@/lib/cr-types";
import { Search, FileText, Brain, Bot, Factory, Monitor, ArrowLeft, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";

const FALLBACK_FILES: CrKnowledgeFile[] = [
  { path: "IDENTITY.md", name: "IDENTITY.md", category: "core", size: 2400, lastModified: new Date().toISOString(), preview: "# Donna AI\nYou are Donna, an AI assistant..." },
  { path: "SOUL.md", name: "SOUL.md", category: "core", size: 4800, lastModified: new Date().toISOString(), preview: "# Soul Operations\nCore behavioral guidelines..." },
  { path: "AGENTS.md", name: "AGENTS.md", category: "core", size: 3200, lastModified: new Date().toISOString(), preview: "# Agent Registry\nActive agents and their roles..." },
  { path: "skills/email-triage.md", name: "email-triage.md", category: "skills", size: 1800, lastModified: new Date().toISOString(), preview: "# Email Triage\nProcess incoming emails..." },
  { path: "research/voice-ai.md", name: "voice-ai.md", category: "research", size: 6400, lastModified: new Date().toISOString(), preview: "# Voice AI Research\nCurrent state of voice..." },
  { path: "memory/active-tasks.md", name: "active-tasks.md", category: "memory", size: 900, lastModified: new Date().toISOString(), preview: "# Active Tasks\n- Deploy Mission Control..." },
];

const FALLBACK_PRODUCTS: CrEcosystemProduct[] = [
  { slug: "openclaw", name: "OpenClaw", tagline: "Agent framework for AI autonomy", icon: "Brain", color: "#00d4ff", status: "active", techStack: ["Node.js", "TypeScript", "SQLite"] },
  { slug: "donna-ai", name: "Donna AI", tagline: "24/7 AI assistant on Mac Studio", icon: "Bot", color: "#a855f7", status: "active", techStack: ["OpenClaw", "Haiku 4.5", "Telegram", "Discord"] },
  { slug: "factory-os", name: "Factory OS", tagline: "Manufacturing brain for Achaiki Pita", icon: "Factory", color: "#f59e0b", status: "active", techStack: ["Electron", "React", "SQLite", "Claude"] },
  { slug: "mission-control", name: "Mission Control", tagline: "Visual command center for OpenClaw", icon: "Monitor", color: "#06b6d4", status: "development", techStack: ["Next.js", "Convex", "Tailwind"] },
];

const FALLBACK_PRODUCT_DETAILS: Record<string, CrEcosystemProduct> = {
  openclaw: { slug: "openclaw", name: "OpenClaw", tagline: "Agent framework for AI autonomy", icon: "Brain", color: "#00d4ff", status: "active", techStack: ["Node.js", "TypeScript", "SQLite"], links: { github: "https://github.com/gk/openclaw" }, metrics: { agents: 2, tasks: 147, uptime: "99.9%" } },
  "donna-ai": { slug: "donna-ai", name: "Donna AI", tagline: "24/7 AI assistant on Mac Studio", icon: "Bot", color: "#a855f7", status: "active", techStack: ["OpenClaw", "Haiku 4.5", "Telegram", "Discord"], links: {}, metrics: { messages: 1240, tasks: 89, uptime: "99.7%" } },
  "factory-os": { slug: "factory-os", name: "Factory OS", tagline: "Manufacturing brain for Achaiki Pita", icon: "Factory", color: "#f59e0b", status: "active", techStack: ["Electron", "React", "SQLite", "Claude"], links: {}, metrics: { batches: 420, sprints: 7, uptime: "100%" } },
  "mission-control": { slug: "mission-control", name: "Mission Control", tagline: "Visual command center for OpenClaw", icon: "Monitor", color: "#06b6d4", status: "development", techStack: ["Next.js", "Convex", "Tailwind"], links: {}, metrics: { pages: 8, components: 12 } },
};

const CATEGORY_COLORS: Record<string, string> = {
  core: "bg-mc-accent/20 text-mc-accent",
  skills: "bg-purple-500/20 text-purple-300",
  research: "bg-amber-500/20 text-amber-300",
  memory: "bg-emerald-500/20 text-emerald-300",
  root: "bg-mc-bg-surface text-mc-text-muted",
};

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-8 w-8" />,
  Bot: <Bot className="h-8 w-8" />,
  Factory: <Factory className="h-8 w-8" />,
  Monitor: <Monitor className="h-8 w-8" />,
};

const PRODUCT_ICONS_LG: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-12 w-12" />,
  Bot: <Bot className="h-12 w-12" />,
  Factory: <Factory className="h-12 w-12" />,
  Monitor: <Monitor className="h-12 w-12" />,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

export function EcosystemView() {
  const [activeTab, setActiveTab] = useState("knowledge");
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: filesData } = useWorkspaceApi<{ files: CrKnowledgeFile[] }>(
    `/api/knowledge${search ? `?search=${encodeURIComponent(search)}` : ""}`
  );
  const { data: productsData } = useWorkspaceApi<{ products: CrEcosystemProduct[] }>("/api/ecosystem");
  const { data: detailData } = useWorkspaceApi<{ product: CrEcosystemProduct }>(
    selectedSlug ? `/api/ecosystem/${selectedSlug}` : "/api/ecosystem",
    { enabled: !!selectedSlug }
  );

  const files = filesData?.files ?? FALLBACK_FILES;
  const products = productsData?.products ?? FALLBACK_PRODUCTS;

  const filteredFiles = search
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.category.toLowerCase().includes(search.toLowerCase()) ||
          (f.preview ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : files;

  // Product detail view
  if (selectedSlug) {
    const product = detailData?.product ?? FALLBACK_PRODUCT_DETAILS[selectedSlug];

    if (!product) {
      return (
        <SectionLayout>
          <SectionHeader title="Ecosystem" />
          <SectionBody width="content" padding="regular">
            <button
              onClick={() => setSelectedSlug(null)}
              className="flex items-center gap-2 text-sm text-mc-text-muted hover:text-mc-text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Ecosystem
            </button>
            <div className="mt-8 text-mc-text-muted">Product not found.</div>
          </SectionBody>
        </SectionLayout>
      );
    }

    const metrics = product.metrics
      ? Object.entries(product.metrics as Record<string, string | number>)
      : [];
    const links = product.links
      ? Object.entries(product.links as Record<string, string>)
      : [];

    return (
      <SectionLayout>
        <SectionHeader title={product.name} description={product.tagline} />
        <SectionBody width="content" padding="regular">
          <button
            onClick={() => setSelectedSlug(null)}
            className="flex items-center gap-2 text-sm text-mc-text-muted hover:text-mc-text-primary transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ecosystem
          </button>

          {/* Hero */}
          <GlassCard>
            <div className="flex items-start gap-6">
              <div
                className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${product.color}20`, color: product.color }}
              >
                {PRODUCT_ICONS_LG[product.icon] ?? <Monitor className="h-12 w-12" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold text-mc-text-primary">{product.name}</h1>
                  <CrStatusBadge
                    status={
                      product.status === "active"
                        ? "active"
                        : product.status === "development"
                        ? "paused"
                        : "idle"
                    }
                    label={product.status}
                  />
                </div>
                <p className="mt-2 text-base text-mc-text-secondary">{product.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-lg px-2.5 py-1 text-sm text-mc-text-secondary bg-mc-bg-surface border border-white/[0.06]"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Metrics */}
          {metrics.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-mc-text-muted">
                Metrics
              </h2>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                {metrics.map(([key, value]) => (
                  <MetricCard
                    key={key}
                    label={key}
                    value={String(value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-mc-text-muted">
                Links
              </h2>
              <div className="flex flex-wrap gap-2">
                {links.map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-mc-accent bg-mc-accent/10 hover:bg-mc-accent/20 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </SectionBody>
      </SectionLayout>
    );
  }

  // List view
  return (
    <SectionLayout>
      <SectionHeader
        title="Ecosystem"
        description="Workspace files and ecosystem products"
        actions={
          <CrTabBar
            tabs={KNOWLEDGE_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            layoutId="knowledge-tabs"
          />
        }
      />
      <SectionBody width="wide" padding="regular">
        {activeTab === "knowledge" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mc-text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files..."
                className="pl-9 bg-mc-bg-surface border-white/[0.06] text-mc-text-primary placeholder:text-mc-text-muted"
              />
            </div>
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <GlassCard key={file.path} hover>
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-mc-text-muted" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-mc-text-primary">
                          {file.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[file.category] ?? CATEGORY_COLORS.root}`}
                        >
                          {file.category}
                        </span>
                        <span className="text-xs text-mc-text-muted ml-auto">
                          {formatSize(file.size)}
                        </span>
                      </div>
                      {file.preview && (
                        <p className="mt-1 text-xs text-mc-text-muted font-mono leading-relaxed">
                          {truncate(file.preview, 120)}
                        </p>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ecosystem" && (
          <StaggerGrid columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {products.map((product) => (
              <GlassCard
                key={product.slug}
                hover
                onClick={() => setSelectedSlug(product.slug)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${product.color}20`, color: product.color }}
                  >
                    {PRODUCT_ICONS[product.icon] ?? <Monitor className="h-8 w-8" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-mc-text-primary">
                        {product.name}
                      </h3>
                      <CrStatusBadge
                        status={product.status === "active" ? "active" : product.status === "development" ? "paused" : "idle"}
                        label={product.status}
                      />
                    </div>
                    <p className="mt-0.5 text-sm text-mc-text-secondary">{product.tagline}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {product.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded px-1.5 py-0.5 text-xs text-mc-text-muted bg-mc-bg-surface"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </StaggerGrid>
        )}
      </SectionBody>
    </SectionLayout>
  );
}
