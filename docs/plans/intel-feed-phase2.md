# Feature Plan: Intel Feed — Phase 2 (Extended Sources + Frontend)

## Goal
Add HN and Reddit fetchers, build the frontend Intel Feed view in Mission Control, wire into sidebar.

## Success Criteria
- [ ] HN fetcher pulls top AI/dev stories daily
- [ ] Reddit fetcher pulls top posts from r/ClaudeCode and r/LocalLLaMA
- [ ] Intel Feed view renders in Mission Control under "Intel" sidebar tab
- [ ] Entries displayed as cards with: title, source icon, date, tag, rating, snippet
- [ ] Filter bar works: by source, category, rating, tier
- [ ] Click entry opens original URL in new tab
- [ ] Visual indicators: 🔥 red glow, 📌 amber, ⏭️ muted
- [ ] Responsive layout

## References
- PRD: `docs/PRD-intel-feed.md`
- Phase 1 plan: `docs/plans/intel-feed-phase1.md`
- Existing view patterns: `src/components/agents-view.tsx`, `src/components/tasks-view.tsx`
- HN API: https://github.com/HackerNews/API
- Reddit JSON: https://www.reddit.com/r/{subreddit}/top.json?t=day

## Implementation Plan

### Task 1: HN Fetcher (`src/lib/intel/fetchers/hackernews.ts`)
- Fetch top story IDs from `https://hacker-news.firebaseio.com/v0/topstories.json`
- Fetch top 30 stories in parallel
- Filter by keywords: AI, LLM, Claude, GPT, coding agent, TypeScript, Next.js, Electron, SQLite, open source
- Map to `FetchedEntry` format
- Keep top 10 after filtering

### Task 2: Reddit Fetcher (`src/lib/intel/fetchers/reddit.ts`)
- Fetch `https://www.reddit.com/r/{subreddit}/top.json?t=day&limit=10`
- Filter by score threshold (50 for r/ClaudeCode, 100 for r/LocalLLaMA)
- Map to `FetchedEntry` format
- Set User-Agent to avoid blocks

### Task 3: Register New Sources
- Add HN and Reddit sources to `sources.ts`
- Wire fetchers into scanner

### Task 4: Frontend — Intel Feed View (`src/components/intel-feed-view.tsx`)
- Fetch from `/api/intel` with useEffect + auto-refresh every 60s
- Filter bar at top: source dropdown, category pills, rating filter, tier filter
- Entry cards:
  - Title (link to original)
  - Source name + tier badge
  - Published date (relative: "2h ago", "yesterday")
  - Category tag (colored pill)
  - Rating indicator (🔥/📌/⏭️/unrated)
  - Summary or snippet (expandable)
- Empty state: "No entries yet. Run a scan to get started."
- Loading skeleton while fetching
- Follow existing Mission Control component patterns (Tailwind, dark theme)

### Task 5: Wire into Sidebar + Router
- Add to `src/components/sidebar.tsx`: `{ section: "intel", label: "Intel Feed", icon: Rss }`
- Add to `src/app/page.tsx`: `case "intel": return <IntelFeedView />`
- Import Rss icon from lucide-react

### Task 6: Scan Button in UI
- Add "Scan Now" button in the Intel Feed view header
- Calls POST `/api/intel/scan`
- Shows loading spinner during scan
- Refreshes feed after scan completes

## Validation Strategy

### Automated
- `tsc --noEmit` clean
- `npm run build` succeeds

### Manual
1. Trigger scan — verify HN and Reddit entries appear
2. Open Intel Feed tab — verify entries render
3. Test each filter — verify filtering works
4. Click an entry — verify it opens in new tab
5. Test on narrow viewport — verify responsive
6. Test "Scan Now" button — verify it works
