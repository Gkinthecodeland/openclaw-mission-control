/**
 * Intel Feed — Scanner orchestrator.
 *
 * Fetches all sources in parallel, deduplicates by URL, stores in SQLite.
 */

import { SOURCES, type Source, type FetchedEntry, type Fetcher } from "./sources";
import { fetchRss } from "./fetchers/rss";
import { fetchGitHubReleases } from "./fetchers/github";
import { fetchHackerNews } from "./fetchers/hackernews";
import { fetchReddit } from "./fetchers/reddit";
import { insertEntry } from "./db";

// ── Fetcher registry ───────────────────────────────

const FETCHERS: Record<string, Fetcher> = {
  rss: fetchRss,
  github: fetchGitHubReleases,
  hackernews: fetchHackerNews,
  reddit: fetchReddit,
};

export type ScanStats = {
  total: number;
  new: number;
  skipped: number;
  errors: string[];
};

/**
 * Run a full scan across all sources.
 * @param seedDays — how many days back to look (7 for initial seed, 1 for daily)
 */
export async function runScan(seedDays = 1): Promise<ScanStats> {
  const stats: ScanStats = { total: 0, new: 0, skipped: 0, errors: [] };

  // Group sources by type and fetch in parallel
  const tasks = SOURCES.map(async (source: Source) => {
    const fetcher = FETCHERS[source.type];
    if (!fetcher) {
      stats.errors.push(`No fetcher for source type: ${source.type} (${source.id})`);
      return [];
    }
    return fetcher(source, { seedDays });
  });

  const results = await Promise.allSettled(tasks);

  // Collect all entries, dedup by URL in memory before DB insert
  const seen = new Set<string>();
  const allEntries: FetchedEntry[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      for (const entry of result.value) {
        if (!seen.has(entry.url)) {
          seen.add(entry.url);
          allEntries.push(entry);
        }
      }
    } else {
      const source = SOURCES[i];
      stats.errors.push(`${source.id}: ${result.reason}`);
    }
  }

  stats.total = allEntries.length;

  // Insert into DB
  for (const entry of allEntries) {
    const inserted = insertEntry({
      url: entry.url,
      title: entry.title,
      source: entry.source,
      sourceTier: entry.sourceTier,
      rawSnippet: entry.rawSnippet,
      publishedAt: entry.publishedAt,
    });
    if (inserted) {
      stats.new++;
    } else {
      stats.skipped++;
    }
  }

  console.log(
    `[intel] Scan complete: ${stats.total} fetched, ${stats.new} new, ${stats.skipped} dupes, ${stats.errors.length} errors`
  );

  return stats;
}
