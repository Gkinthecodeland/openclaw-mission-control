"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Rss,
  RefreshCw,
  ExternalLink,
  Filter,
  Flame,
  Pin,
  SkipForward,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionBody, SectionHeader, SectionLayout } from "@/components/section-layout";
import { LoadingState } from "@/components/ui/loading-state";
import type { IntelEntry, EntryStats } from "@/lib/intel/db";

// ── Types ─────────────────────────────────────────

type ApiResponse = {
  entries: IntelEntry[];
  total: number;
  stats: EntryStats;
};

type ScanResponse = {
  ok: boolean;
  stats: { total: number; new: number; skipped: number; errors: string[] };
};

// ── Constants ─────────────────────────────────────

const CATEGORIES = [
  "model-update",
  "security",
  "breaking-change",
  "new-tool",
  "our-stack",
  "general",
] as const;

const RATINGS = ["fire", "pin", "skip", "unrated"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  "model-update": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  security: "bg-red-500/15 text-red-400 border-red-500/20",
  "breaking-change": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "new-tool": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "our-stack": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  general: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  uncategorized: "bg-zinc-500/10 text-zinc-500 border-zinc-500/15",
};

const RATING_CONFIG: Record<string, { icon: typeof Flame; label: string; className: string }> = {
  fire: { icon: Flame, label: "Important", className: "text-red-400" },
  pin: { icon: Pin, label: "Worth knowing", className: "text-amber-400" },
  skip: { icon: SkipForward, label: "Skip", className: "text-zinc-500" },
  unrated: { icon: AlertCircle, label: "Unrated", className: "text-zinc-600" },
};

const TIER_LABELS: Record<number, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-violet-500/15 text-violet-400",
  2: "bg-blue-500/15 text-blue-400",
  3: "bg-zinc-500/15 text-zinc-400",
};

// ── Helpers ───────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sourceLabel(sourceId: string): string {
  const map: Record<string, string> = {
    "anthropic-blog": "Anthropic",
    "claude-code": "Claude Code",
    "nextjs-blog": "Next.js",
    electron: "Electron",
    typescript: "TypeScript",
    tailwindcss: "Tailwind CSS",
    nodejs: "Node.js",
    "vercel-blog": "Vercel",
    "drizzle-orm": "Drizzle ORM",
    hn: "Hacker News",
    "r-claudecode": "r/ClaudeCode",
    "r-localllama": "r/LocalLLaMA",
    "simon-willison": "Simon Willison",
    "latent-space": "Latent Space",
    "pragmatic-engineer": "Pragmatic Eng.",
  };
  return map[sourceId] ?? sourceId;
}

// ── Components ────────────────────────────────────

function FilterBar({
  sources,
  activeSource,
  activeCategory,
  activeRating,
  activeTier,
  onSourceChange,
  onCategoryChange,
  onRatingChange,
  onTierChange,
}: {
  sources: string[];
  activeSource: string;
  activeCategory: string;
  activeRating: string;
  activeTier: string;
  onSourceChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onRatingChange: (v: string) => void;
  onTierChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-black/5 px-3 py-2 dark:bg-white/[0.02]">
      <Filter className="h-3.5 w-3.5 text-muted-foreground/60" />

      {/* Source */}
      <select
        value={activeSource}
        onChange={(e) => onSourceChange(e.target.value)}
        className="rounded-md border border-border/50 bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-violet-500/50"
      >
        <option value="">All Sources</option>
        {sources.map((s) => (
          <option key={s} value={s}>{sourceLabel(s)}</option>
        ))}
      </select>

      {/* Category pills */}
      <select
        value={activeCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="rounded-md border border-border/50 bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-violet-500/50"
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Rating */}
      <select
        value={activeRating}
        onChange={(e) => onRatingChange(e.target.value)}
        className="rounded-md border border-border/50 bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-violet-500/50"
      >
        <option value="">All Ratings</option>
        {RATINGS.map((r) => (
          <option key={r} value={r}>{RATING_CONFIG[r].label}</option>
        ))}
      </select>

      {/* Tier */}
      <select
        value={activeTier}
        onChange={(e) => onTierChange(e.target.value)}
        className="rounded-md border border-border/50 bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-violet-500/50"
      >
        <option value="">All Tiers</option>
        <option value="1">Tier 1 — Stack</option>
        <option value="2">Tier 2 — Monitoring</option>
        <option value="3">Tier 3 — People</option>
      </select>
    </div>
  );
}

function RatingBadge({ rating }: { rating: string | null }) {
  const key = rating ?? "unrated";
  const config = RATING_CONFIG[key] ?? RATING_CONFIG.unrated;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1", config.className)} title={config.label}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function EntryCard({ entry }: { entry: IntelEntry }) {
  const category = entry.category ?? "uncategorized";
  const isFireRating = entry.rating === "fire";
  const isSkipRating = entry.rating === "skip";

  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group block rounded-lg border p-3 transition-all hover:border-violet-500/30 hover:bg-white/[0.02]",
        isFireRating
          ? "border-red-500/20 bg-red-500/[0.03] shadow-[0_0_15px_-5px_rgba(239,68,68,0.15)]"
          : isSkipRating
            ? "border-border/30 opacity-60"
            : "border-border/40"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rating icon */}
        <div className="mt-0.5 shrink-0">
          <RatingBadge rating={entry.rating} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug text-foreground group-hover:text-violet-300">
              {entry.title}
            </h3>
            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">{sourceLabel(entry.source)}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", TIER_COLORS[entry.source_tier] ?? TIER_COLORS[2])}>
              {TIER_LABELS[entry.source_tier] ?? "Tier ?"}
            </span>
            {category !== "uncategorized" && (
              <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general)}>
                {category}
              </span>
            )}
            <span className="text-muted-foreground/60">{timeAgo(entry.published_at)}</span>
          </div>

          {/* Summary or snippet */}
          {(entry.summary || entry.raw_snippet) && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/70">
              {entry.summary || entry.raw_snippet}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Main View ─────────────────────────────────────

export function IntelFeedView() {
  const [entries, setEntries] = useState<IntelEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<EntryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterSource, setFilterSource] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [filterTier, setFilterTier] = useState("");

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSource) params.set("source", filterSource);
      if (filterCategory) params.set("category", filterCategory);
      if (filterRating) params.set("rating", filterRating);
      if (filterTier) params.set("tier", filterTier);
      params.set("limit", "100");

      const resp = await fetch(`/api/intel?${params.toString()}`);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const data = (await resp.json()) as ApiResponse;
      setEntries(data.entries);
      setTotal(data.total);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filterSource, filterCategory, filterRating, filterTier]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    setLoading(true);
    fetchEntries();
    const interval = setInterval(fetchEntries, 60000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const resp = await fetch("/api/intel/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedDays: 1 }),
      });
      if (!resp.ok) throw new Error(`Scan failed: ${resp.status}`);
      const data = (await resp.json()) as ScanResponse;
      setScanResult(`Scan complete: ${data.stats.new} new, ${data.stats.skipped} duplicates`);
      // Refresh feed
      await fetchEntries();
    } catch (err) {
      setScanResult(`Scan error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  }, [fetchEntries]);

  // Build unique sources list from stats
  const sourceList = stats ? Object.keys(stats.bySource).sort() : [];

  return (
    <SectionLayout>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-violet-400" />
            Intel Feed
          </span>
        }
        description={
          stats
            ? `${stats.total} entries from ${Object.keys(stats.bySource).length} sources`
            : "Tech intelligence aggregator"
        }
        actions={
          <div className="flex items-center gap-2">
            {scanResult && (
              <span className="text-xs text-muted-foreground/70">{scanResult}</span>
            )}
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
              )}
            >
              <RefreshCw className={cn("h-3 w-3", scanning && "animate-spin")} />
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>
        }
      />

      <SectionBody width="wide" padding="regular">
        {/* Filter bar */}
        <FilterBar
          sources={sourceList}
          activeSource={filterSource}
          activeCategory={filterCategory}
          activeRating={filterRating}
          activeTier={filterTier}
          onSourceChange={setFilterSource}
          onCategoryChange={setFilterCategory}
          onRatingChange={setFilterRating}
          onTierChange={setFilterTier}
        />

        {/* Content */}
        <div className="mt-4">
          {loading ? (
            <LoadingState label="Loading intel feed..." />
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Rss className="h-8 w-8 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground/70">No entries yet</p>
                <p className="mt-1 text-xs text-muted-foreground/50">
                  Run a scan to fetch the latest intel from all sources.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2 text-xs text-muted-foreground/50">
                Showing {entries.length} of {total} entries
              </div>
              <div className="flex flex-col gap-2">
                {entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </>
          )}
        </div>
      </SectionBody>
    </SectionLayout>
  );
}
