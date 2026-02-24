# Intel Feed — PRD

## Overview
A tech intelligence feed built into Mission Control that aggregates primary sources (blogs, RSS, GitHub releases, Reddit, HN), stores them locally, and surfaces what matters. Jarvis scans daily and annotates entries with relevance ratings. Telegram notifications for critical finds only.

## MVP Scope

### Features
- [ ] RSS/Atom feed aggregator for blogs and release pages
- [ ] GitHub release tracker (polling API for specific repos)
- [ ] Hacker News top stories (filtered for AI/dev)
- [ ] Reddit scraper (r/ClaudeCode, r/LocalLLaMA — top posts)
- [ ] Blog scrapers for non-RSS sources (Simon Willison, Swyx/latent.space)
- [ ] SQLite storage for all entries (deduplicated by URL)
- [ ] Auto-categorization with tags: `model-update`, `security`, `breaking-change`, `new-tool`, `our-stack`, `general`
- [ ] Relevance rating system: 🔥 important / 📌 worth knowing / ⏭️ skip
- [ ] API endpoint for Mission Control frontend (`/api/intel`)
- [ ] Cron job: daily scan + Jarvis annotation
- [ ] Telegram notification for 🔥 entries only

### Out of Scope (v1)
- Full article archiving/caching
- Custom source management UI (add/remove sources from UI)
- Search across historical entries
- AI-generated weekly digest
- Twitter/X integration (API too expensive/unreliable)

## Tech Stack
- Runtime: Node.js
- Database: SQLite (via better-sqlite3)
- Feed parsing: rss-parser npm package
- HTTP: native fetch
- Frontend: React + Tailwind (Mission Control existing patterns)
- Cron: OpenClaw cron job for daily scan
- Notifications: OpenClaw Telegram message tool

## Architecture

### Backend
- `src/lib/intel/` — Core intel feed logic
  - `sources.ts` — Source definitions and fetcher registry
  - `fetchers/rss.ts` — Generic RSS/Atom fetcher
  - `fetchers/github.ts` — GitHub releases fetcher (gh CLI or API)
  - `fetchers/hackernews.ts` — HN top stories fetcher
  - `fetchers/reddit.ts` — Reddit JSON API fetcher
  - `db.ts` — SQLite schema and queries
  - `scanner.ts` — Orchestrator: fetch all sources, dedupe, store
- `src/app/api/intel/route.ts` — API endpoint for frontend
- `src/app/api/intel/scan/route.ts` — Trigger scan endpoint (called by cron)

### Frontend
- `src/components/intel-feed-view.tsx` — Main feed view component
  - Filterable by tag, source, rating
  - Entries show: title, source, date, tag, rating, summary
  - 🔥/📌/⏭️ visual indicators
  - Click to open original article

### Data Flow
1. Cron fires daily → hits `/api/intel/scan`
2. Scanner fetches all sources in parallel
3. New entries stored in SQLite (dedupe by URL)
4. Jarvis reviews new entries, adds ratings + summaries
5. Frontend polls `/api/intel` for display
6. 🔥 entries trigger Telegram notification

## Data Model

### `intel_entries` table
```sql
CREATE TABLE intel_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,        -- e.g. "anthropic-blog", "hn", "r/ClaudeCode"
  source_tier INTEGER DEFAULT 1,  -- 1, 2, or 3
  category TEXT,               -- model-update, security, breaking-change, new-tool, our-stack, general
  rating TEXT,                 -- fire, pin, skip, unrated
  summary TEXT,                -- Jarvis annotation (2-3 sentences for important, one-liner for rest)
  published_at TEXT,           -- ISO date from source
  fetched_at TEXT NOT NULL,    -- when we scraped it
  reviewed_at TEXT,            -- when Jarvis reviewed it
  raw_snippet TEXT,            -- first 500 chars of content for context
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Sources

### Tier 1 — Direct stack impact
| Source | Type | URL/Feed |
|--------|------|----------|
| Anthropic Blog | RSS | https://www.anthropic.com/rss.xml |
| Claude Code | GitHub | anthropics/claude-code releases |
| OpenClaw | GitHub | openclaw/openclaw releases |
| Next.js Blog | RSS | https://nextjs.org/blog/rss.xml |
| Electron | GitHub | electron/electron releases |
| TypeScript | GitHub | microsoft/TypeScript releases |
| Tailwind CSS | RSS/Blog | https://tailwindcss.com/blog |
| Node.js | GitHub | nodejs/node releases |

### Tier 2 — Worth monitoring
| Source | Type | URL/Feed |
|--------|------|----------|
| Hacker News | API | Top 10 daily, AI/dev keywords filtered |
| r/ClaudeCode | Reddit JSON | Top posts, score > 50 |
| r/LocalLLaMA | Reddit JSON | Top posts, score > 100 |
| Vercel Blog | RSS | https://vercel.com/blog/rss.xml |
| Drizzle ORM | GitHub | drizzle-team/drizzle-orm releases |
| SQLite | Web | https://sqlite.org/changes.html |

### Tier 3 — People
| Source | Type | URL/Feed |
|--------|------|----------|
| Simon Willison | RSS | https://simonwillison.net/atom/everything/ |
| Swyx (latent.space) | RSS | https://www.latent.space/feed |
| Pragmatic Engineer | RSS | https://newsletter.pragmaticengineer.com/feed |

## Phases of Work

### Phase 1: Foundation
- SQLite database setup + schema
- Source registry with fetcher interface
- RSS fetcher (covers most Tier 1 + Tier 3 sources)
- GitHub releases fetcher
- Scanner orchestrator
- API endpoint `/api/intel` (list entries, filter by tag/source/rating)
- API endpoint `/api/intel/scan` (trigger scan)
- Seed last 7 days of data

### Phase 2: Extended Sources + Frontend
- HN fetcher (top stories, keyword filter)
- Reddit fetcher (JSON API, score threshold)
- Frontend `intel-feed-view.tsx` component
- Wire into Mission Control sidebar
- Filter UI (by tag, source, tier, rating)
- Responsive card layout for entries

### Phase 3: Jarvis Integration
- OpenClaw cron job: daily morning scan
- Jarvis review flow: fetch unrated entries, annotate with rating + summary
- Telegram notification for 🔥 entries
- Auto-categorization logic

## Environment Variables
- None required for v1 (all public APIs, no auth needed)
- GitHub: uses existing `gh` CLI auth for release fetching
- Reddit: public JSON API (no auth needed for read)

## Success Criteria
- [ ] Daily scan fetches from all sources without errors
- [ ] Entries are deduplicated (no duplicate URLs)
- [ ] Frontend displays entries with filters working
- [ ] Jarvis can review and annotate entries via cron
- [ ] 🔥 entries trigger Telegram notification to GK
- [ ] Last 7 days seeded on first run
