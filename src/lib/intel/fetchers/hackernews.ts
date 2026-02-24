/**
 * Intel Feed — Hacker News fetcher.
 *
 * Fetches top stories from HN Firebase API, filters by AI/dev keywords.
 * Keeps top 10 relevant stories.
 */

import type { Source, FetchedEntry, Fetcher } from "../sources";

const HN_API = "https://hacker-news.firebaseio.com/v0";

const KEYWORDS = [
  "ai", "llm", "claude", "gpt", "openai", "anthropic", "gemini",
  "coding agent", "code agent", "typescript", "next.js", "nextjs",
  "electron", "sqlite", "open source", "machine learning", "deep learning",
  "transformer", "neural", "copilot", "cursor", "windsurf",
  "langchain", "vector database", "rag", "fine-tun", "embedding",
];

type HNStory = {
  id: number;
  title: string;
  url?: string;
  score: number;
  time: number;
  descendants?: number;
  type: string;
};

function matchesKeywords(title: string): boolean {
  const lower = title.toLowerCase();
  return KEYWORDS.some((kw) => lower.includes(kw));
}

export const fetchHackerNews: Fetcher = async (_source: Source, options = {}) => {
  const seedDays = options.seedDays ?? 1;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - seedDays);

  try {
    // Fetch top story IDs
    const idsResp = await fetch(`${HN_API}/topstories.json`, {
      headers: { "User-Agent": "MissionControl-IntelFeed/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!idsResp.ok) {
      console.error(`[intel] HN topstories API returned ${idsResp.status}`);
      return [];
    }

    const allIds = (await idsResp.json()) as number[];
    // Fetch top 30 stories in parallel to find 10 relevant ones
    const top30 = allIds.slice(0, 30);

    const storyPromises = top30.map(async (id): Promise<HNStory | null> => {
      try {
        const resp = await fetch(`${HN_API}/item/${id}.json`, {
          headers: { "User-Agent": "MissionControl-IntelFeed/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return null;
        return (await resp.json()) as HNStory;
      } catch {
        return null;
      }
    });

    const stories = (await Promise.all(storyPromises)).filter(
      (s): s is HNStory => s !== null && s.type === "story"
    );

    // Filter by date and keywords
    const entries: FetchedEntry[] = [];

    for (const story of stories) {
      const publishedAt = new Date(story.time * 1000);
      if (publishedAt < cutoff) continue;
      if (!matchesKeywords(story.title)) continue;

      const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
      const comments = story.descendants ?? 0;
      const snippet = `Score: ${story.score} | Comments: ${comments}`;

      entries.push({
        url,
        title: story.title,
        source: "hn",
        sourceTier: 2,
        rawSnippet: snippet,
        publishedAt: publishedAt.toISOString(),
      });

      if (entries.length >= 10) break;
    }

    return entries;
  } catch (err) {
    console.error(`[intel] HN fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }
};
