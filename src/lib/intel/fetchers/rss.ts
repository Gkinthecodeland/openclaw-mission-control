/**
 * Intel Feed — RSS/Atom feed fetcher.
 *
 * Uses rss-parser to fetch and parse feeds.
 * Filters entries by date (seedDays for initial, 1 day for daily).
 */

import Parser from "rss-parser";
import type { Source, FetchedEntry, Fetcher } from "../sources";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "MissionControl-IntelFeed/1.0",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export const fetchRss: Fetcher = async (source: Source, options = {}) => {
  const seedDays = options.seedDays ?? 1;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - seedDays);

  try {
    const feed = await parser.parseURL(source.url);
    const entries: FetchedEntry[] = [];

    for (const item of feed.items) {
      if (!item.link || !item.title) continue;

      // Parse date — rss-parser provides isoDate or pubDate
      let publishedAt: string | null = null;
      if (item.isoDate) {
        publishedAt = item.isoDate;
      } else if (item.pubDate) {
        const d = new Date(item.pubDate);
        if (!isNaN(d.getTime())) publishedAt = d.toISOString();
      }

      // Filter by date
      if (publishedAt) {
        const pubDate = new Date(publishedAt);
        if (pubDate < cutoff) continue;
      }

      // Extract snippet from content
      const rawContent = item.contentSnippet || item.content || item.summary || "";
      const snippet = stripHtml(rawContent).slice(0, 500) || null;

      entries.push({
        url: item.link,
        title: item.title.trim(),
        source: source.id,
        sourceTier: source.tier,
        rawSnippet: snippet,
        publishedAt,
      });
    }

    return entries;
  } catch (err) {
    console.error(`[intel] RSS fetch failed for ${source.id} (${source.url}):`, err instanceof Error ? err.message : err);
    return [];
  }
};
