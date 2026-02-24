/**
 * Intel Feed — Source registry and types.
 *
 * Defines all monitored sources with their fetcher type and tier.
 */

// ── Types ──────────────────────────────────────────

export type SourceType = "rss" | "github" | "hackernews" | "reddit";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  tier: 1 | 2 | 3;
  url: string;
  /** For GitHub sources: "owner/repo" */
  repo?: string;
};

export type FetchedEntry = {
  url: string;
  title: string;
  source: string;
  sourceTier: number;
  rawSnippet?: string | null;
  publishedAt?: string | null;
};

export type Fetcher = (source: Source, options?: { seedDays?: number }) => Promise<FetchedEntry[]>;

// ── Source Definitions ─────────────────────────────

export const SOURCES: Source[] = [
  // Tier 1 — Direct stack impact
  { id: "anthropic-blog", name: "Anthropic Blog", type: "rss", tier: 1, url: "https://www.anthropic.com/rss.xml" },
  { id: "claude-code", name: "Claude Code", type: "github", tier: 1, url: "https://github.com/anthropics/claude-code", repo: "anthropics/claude-code" },
  { id: "nextjs-blog", name: "Next.js Blog", type: "rss", tier: 1, url: "https://nextjs.org/blog/rss.xml" },
  { id: "electron", name: "Electron", type: "github", tier: 1, url: "https://github.com/electron/electron", repo: "electron/electron" },
  { id: "typescript", name: "TypeScript", type: "github", tier: 1, url: "https://github.com/microsoft/TypeScript", repo: "microsoft/TypeScript" },
  { id: "tailwindcss", name: "Tailwind CSS", type: "rss", tier: 1, url: "https://tailwindcss.com/feeds/feed.xml" },
  { id: "nodejs", name: "Node.js", type: "github", tier: 1, url: "https://github.com/nodejs/node", repo: "nodejs/node" },

  // Tier 2 — Worth monitoring
  { id: "hn", name: "Hacker News", type: "hackernews", tier: 2, url: "https://hacker-news.firebaseio.com/v0" },
  { id: "r-claudecode", name: "r/ClaudeCode", type: "reddit", tier: 2, url: "https://www.reddit.com/r/ClaudeCode/top.json" },
  { id: "r-localllama", name: "r/LocalLLaMA", type: "reddit", tier: 2, url: "https://www.reddit.com/r/LocalLLaMA/top.json" },
  { id: "vercel-blog", name: "Vercel Blog", type: "rss", tier: 2, url: "https://vercel.com/atom" },
  { id: "drizzle-orm", name: "Drizzle ORM", type: "github", tier: 2, url: "https://github.com/drizzle-team/drizzle-orm", repo: "drizzle-team/drizzle-orm" },

  // Tier 3 — People
  { id: "simon-willison", name: "Simon Willison", type: "rss", tier: 3, url: "https://simonwillison.net/atom/everything/" },
  { id: "latent-space", name: "Latent Space (Swyx)", type: "rss", tier: 3, url: "https://www.latent.space/feed" },
  { id: "pragmatic-engineer", name: "Pragmatic Engineer", type: "rss", tier: 3, url: "https://newsletter.pragmaticengineer.com/feed" },
];

/** Get sources filtered by type */
export function getSourcesByType(type: SourceType): Source[] {
  return SOURCES.filter((s) => s.type === type);
}
