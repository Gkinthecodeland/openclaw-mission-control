# Feature Plan: Intel Feed — Phase 1 (Foundation)

## Goal
Build the backend infrastructure: SQLite database, source registry, RSS + GitHub fetchers, scanner orchestrator, and API endpoints. Seed with last 7 days of data.

## Success Criteria
- [ ] SQLite database created at `data/intel.db` with `intel_entries` table
- [ ] RSS fetcher successfully parses Atom and RSS feeds
- [ ] GitHub fetcher pulls releases from specified repos
- [ ] Scanner runs all fetchers in parallel, deduplicates by URL
- [ ] `/api/intel` returns entries with filtering support (source, category, rating, limit, offset)
- [ ] `/api/intel/scan` triggers a full scan and returns results count
- [ ] Database seeded with last 7 days from all RSS + GitHub sources
- [ ] No external dependencies beyond `rss-parser` and `better-sqlite3`

## References
- PRD: `docs/PRD-intel-feed.md`
- Existing API patterns: `src/app/api/agents/route.ts`
- RSS parser docs: https://www.npmjs.com/package/rss-parser
- better-sqlite3 docs: https://github.com/WiseLibs/better-sqlite3
- GitHub REST API releases: https://docs.github.com/en/rest/releases
- Reddit JSON API: append `.json` to any subreddit URL

## Implementation Plan

### Task 1: Install Dependencies
- Run `npm install rss-parser better-sqlite3 @types/better-sqlite3`
- Verify build still passes

### Task 2: SQLite Database Setup (`src/lib/intel/db.ts`)
- Create/open database at `data/intel.db` (auto-create `data/` dir)
- Define schema with `intel_entries` table (see PRD for schema)
- Create indexes on: `url` (unique), `source`, `category`, `rating`, `published_at`
- Export functions:
  - `insertEntry(entry)` — upsert by URL
  - `getEntries(filters)` — query with optional filters (source, category, rating, limit, offset)
  - `getUnratedEntries()` — for Jarvis review
  - `updateRating(id, rating, summary, category)` — Jarvis annotation
  - `getStats()` — count by source, category, rating

### Task 3: Source Registry (`src/lib/intel/sources.ts`)
- Define `Source` type: `{ id, name, type, tier, url, fetcherConfig? }`
- Define `FetchedEntry` type: `{ url, title, source, sourceTier, rawSnippet?, publishedAt }`
- Export `SOURCES` array with all Tier 1, 2, 3 sources from PRD
- Export `Fetcher` interface: `(source: Source) => Promise<FetchedEntry[]>`

### Task 4: RSS Fetcher (`src/lib/intel/fetchers/rss.ts`)
- Use `rss-parser` to fetch and parse RSS/Atom feeds
- Map feed items to `FetchedEntry` format
- Handle date parsing (various formats)
- Filter to last 7 days for initial seed, last 24h for daily runs
- Graceful error handling: log and skip failed feeds, don't crash scanner

### Task 5: GitHub Releases Fetcher (`src/lib/intel/fetchers/github.ts`)
- Use native fetch to hit `https://api.github.com/repos/{owner}/{repo}/releases`
- Respect rate limits (add User-Agent header)
- Map releases to `FetchedEntry` format
- Extract first 500 chars of release body as `rawSnippet`

### Task 6: Scanner Orchestrator (`src/lib/intel/scanner.ts`)
- Fetch all sources in parallel with `Promise.allSettled`
- Collect all `FetchedEntry` results
- Deduplicate by URL
- Insert into SQLite via `db.insertEntry()`
- Return stats: `{ total, new, skipped, errors }`

### Task 7: API Endpoint — List (`src/app/api/intel/route.ts`)
- GET `/api/intel` — returns entries
- Query params: `source`, `category`, `rating`, `tier`, `limit` (default 50), `offset` (default 0)
- Response: `{ entries: [...], total: number, stats: {...} }`
- Follow existing Mission Control API patterns (NextResponse, error handling)

### Task 8: API Endpoint — Scan (`src/app/api/intel/scan/route.ts`)
- POST `/api/intel/scan` — triggers full scan
- Optional body: `{ seedDays?: number }` (default 1, use 7 for initial seed)
- Response: `{ ok: true, stats: { total, new, skipped, errors } }`
- Should be idempotent (dedupe handles re-runs)

### Task 9: Initial Seed
- After all code is in place, trigger a scan with `seedDays: 7`
- Verify entries from all sources are present in the database
- Log any sources that failed

## Validation Strategy

### Automated Testing
- TypeScript compiles with zero errors (`tsc --noEmit`)
- Build succeeds (`npm run build`)

### Manual Testing
1. Run `curl -X POST http://localhost:3333/api/intel/scan -H 'Content-Type: application/json' -d '{"seedDays": 7}'`
2. Verify response shows entries fetched from multiple sources
3. Run `curl http://localhost:3333/api/intel?limit=10`
4. Verify entries returned with correct structure
5. Run `curl http://localhost:3333/api/intel?source=anthropic-blog`
6. Verify filtering works
7. Run scan again — verify no duplicates (new count should be 0 or low)

## Risks & Mitigations
- **Risk:** RSS feeds may have different date formats
  - Mitigation: Use rss-parser's built-in date handling + fallback to `new Date()`
- **Risk:** GitHub API rate limiting (60 req/hr unauthenticated)
  - Mitigation: We have ~15 GitHub sources, well within limits. Add auth header if needed later.
- **Risk:** Reddit may block server-side requests
  - Mitigation: Reddit is Phase 2. For now, skip it.
- **Risk:** Some feeds may be down or return errors
  - Mitigation: `Promise.allSettled` + per-source error logging. Never crash the scanner.
