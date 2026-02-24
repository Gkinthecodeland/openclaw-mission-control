/**
 * Intel Feed — GitHub releases fetcher.
 *
 * Uses GitHub REST API (unauthenticated) to fetch latest releases.
 * Falls back gracefully on rate limit or error.
 */

import type { Source, FetchedEntry, Fetcher } from "../sources";

type GitHubRelease = {
  html_url: string;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  created_at: string;
  prerelease: boolean;
  draft: boolean;
};

export const fetchGitHubReleases: Fetcher = async (source: Source, options = {}) => {
  if (!source.repo) {
    console.error(`[intel] GitHub source ${source.id} missing repo field`);
    return [];
  }

  const seedDays = options.seedDays ?? 1;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - seedDays);

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${source.repo}/releases?per_page=20`,
      {
        headers: {
          "User-Agent": "MissionControl-IntelFeed/1.0",
          Accept: "application/vnd.github.v3+json",
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!resp.ok) {
      if (resp.status === 403) {
        console.warn(`[intel] GitHub rate limited for ${source.repo}`);
      } else {
        console.error(`[intel] GitHub API ${resp.status} for ${source.repo}`);
      }
      return [];
    }

    const releases = (await resp.json()) as GitHubRelease[];
    const entries: FetchedEntry[] = [];

    for (const rel of releases) {
      if (rel.draft) continue;

      const publishedAt = rel.published_at || rel.created_at;
      if (publishedAt) {
        const pubDate = new Date(publishedAt);
        if (pubDate < cutoff) continue;
      }

      const title = rel.name
        ? `${source.name}: ${rel.name}`
        : `${source.name}: ${rel.tag_name}`;

      const snippet = rel.body ? rel.body.slice(0, 500) : null;

      entries.push({
        url: rel.html_url,
        title,
        source: source.id,
        sourceTier: source.tier,
        rawSnippet: snippet,
        publishedAt: publishedAt || null,
      });
    }

    return entries;
  } catch (err) {
    console.error(`[intel] GitHub fetch failed for ${source.id}:`, err instanceof Error ? err.message : err);
    return [];
  }
};
