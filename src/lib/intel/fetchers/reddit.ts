/**
 * Intel Feed — Reddit JSON API fetcher.
 *
 * Fetches top posts from subreddits using public JSON API.
 * Filters by score threshold per subreddit.
 */

import type { Source, FetchedEntry, Fetcher } from "../sources";

type RedditPost = {
  data: {
    title: string;
    url: string;
    permalink: string;
    score: number;
    created_utc: number;
    selftext: string;
    num_comments: number;
    is_self: boolean;
    subreddit: string;
  };
};

type RedditListing = {
  data: {
    children: RedditPost[];
  };
};

/** Score thresholds per subreddit */
const SCORE_THRESHOLDS: Record<string, number> = {
  ClaudeCode: 50,
  LocalLLaMA: 100,
};

export const fetchReddit: Fetcher = async (source: Source, options = {}) => {
  const seedDays = options.seedDays ?? 1;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - seedDays);

  // Extract subreddit from URL: https://www.reddit.com/r/{subreddit}/top.json
  const subreddit = source.url.match(/\/r\/([^/]+)/)?.[1];
  if (!subreddit) {
    console.error(`[intel] Reddit source ${source.id} missing subreddit in URL`);
    return [];
  }

  const threshold = SCORE_THRESHOLDS[subreddit] ?? 50;

  try {
    const resp = await fetch(
      `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=10`,
      {
        headers: {
          "User-Agent": "MissionControl-IntelFeed/1.0 (by /u/mission-control-bot)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!resp.ok) {
      if (resp.status === 429) {
        console.warn(`[intel] Reddit rate limited for r/${subreddit}`);
      } else {
        console.error(`[intel] Reddit API ${resp.status} for r/${subreddit}`);
      }
      return [];
    }

    const listing = (await resp.json()) as RedditListing;
    const entries: FetchedEntry[] = [];

    for (const post of listing.data.children) {
      const { data } = post;
      const publishedAt = new Date(data.created_utc * 1000);

      if (publishedAt < cutoff) continue;
      if (data.score < threshold) continue;

      const url = data.is_self
        ? `https://www.reddit.com${data.permalink}`
        : data.url;

      const snippet = data.selftext
        ? data.selftext.slice(0, 500)
        : `Score: ${data.score} | Comments: ${data.num_comments}`;

      entries.push({
        url,
        title: data.title,
        source: source.id,
        sourceTier: source.tier,
        rawSnippet: snippet,
        publishedAt: publishedAt.toISOString(),
      });
    }

    return entries;
  } catch (err) {
    console.error(`[intel] Reddit fetch failed for r/${subreddit}:`, err instanceof Error ? err.message : err);
    return [];
  }
};
