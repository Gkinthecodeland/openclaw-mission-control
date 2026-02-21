# Mission Control — Improvement Roadmap

> Synthesized from UX audit, competitive research (Grafana, Vercel, Linear, Datadog, LangSmith, Helicone, Home Assistant), and architecture deep-dive.

---

## Quick Wins (ship this week)

### 1. Dynamic Import Heavy Dependencies
**Why:** Monaco (~2MB), xterm, ReactFlow/dagre all load on first paint even if user never opens those views. Lazy loading cuts initial bundle by ~60%.
**How:** `next/dynamic` wrappers with loading skeletons.
**Files:** `page.tsx`, `config-editor.tsx`, `memory-graph-view.tsx`, `terminal-view.tsx`
**Effort:** 2-4 hours

### 2. Skeleton Loading Screens
**Why:** Views snap from empty → content with no visual bridge. `ui/skeleton.tsx` already exists but isn't wired up.
**How:** Replace "Connecting to system..." spinners with shimmer skeletons matching card layouts.
**Files:** `dashboard-view.tsx`, `agents-view.tsx`, `tasks-view.tsx`
**Effort:** 2-3 hours

### 3. Per-Section Error Boundaries
**Why:** One broken component (e.g. memory graph) crashes the entire app. Zero error boundaries exist beyond `global-error.tsx`.
**How:** Reusable `<ErrorBoundary>` class component wrapping each section in `page.tsx`.
**Files:** New `error-boundary.tsx`, `page.tsx`
**Effort:** 2-3 hours

### 4. Sidebar Navigation Groups
**Why:** 24 flat nav items look like a config file. Group into: Core / Agents / Automation / Data / Tools / System with section labels.
**Files:** `sidebar.tsx`
**Effort:** 1-2 hours

### 5. Section Transition Animation
**Why:** Section switches are jarring snaps. `tw-animate-css` is already imported.
**How:** Wrap `<SectionContent>` in fade-in + translateY(4px→0) animation, 150ms.
**Files:** `page.tsx`
**Effort:** 30 minutes

### 6. Animated Number Roll-Up on Stats
**Why:** Static number updates feel dead. A 300ms ease-out counter animation makes the dashboard feel alive.
**Files:** `dashboard-view.tsx` (StatCard component)
**Effort:** 1 hour (20-line hook)

### 7. Gradient Glow on Active/Alert Cards
**Why:** All cards have identical `border-foreground/10` borders — no visual hierarchy.
**How:** CSS glow shadow + gradient border on critical issues and active agent cards.
**Files:** `globals.css`, `dashboard-view.tsx`
**Effort:** 1 hour

### 8. Better Empty States
**Why:** "No recent log entries" is a dead end. Empty states should be onboarding moments with icon + title + CTA.
**Files:** `dashboard-view.tsx`, `cron-view.tsx`, `logs-view.tsx`
**Effort:** 2 hours

---

## Medium Term (next 2 weeks)

### 9. Global Command Palette (Cmd+K)
**Why:** #1 power-user expectation in modern dashboards. Current Cmd+K only opens memory search. Need: section navigation, actions (restart gateway, create cron, ping agent, toggle theme), fuzzy search.
**How:** New `command-palette.tsx` using `cmdk` library. Two modes: navigate + actions.
**Files:** New `command-palette.tsx`, `header.tsx`, `keyboard-shortcuts.tsx`
**Effort:** 1 day
**Inspiration:** Linear, Raycast

### 10. Unified SSE Bus (replace scattered polling)
**Why:** 10+ independent polling loops (3s-30s each) hammering the server. `/api/agents` fetched by two components independently with zero coordination.
**How:** Single `/api/stream` endpoint multiplexing typed events (`gateway-status`, `agent-update`, `log-line`, `session-update`, `cron-run`). Client subscribes to event types.
**Files:** New `event-bus.ts`, `api/stream/route.ts`, refactor all polling components
**Effort:** 2-3 days

### 11. Shared Query Cache (SWR-like)
**Why:** Same endpoints fetched by multiple components independently. No deduplication, no stale-while-revalidate.
**How:** `createQuery(key, fetcher, options)` with TTL cache + subscriber invalidation. ~100 LOC or add SWR dependency.
**Files:** New `query-cache.ts`, update `agents-view.tsx`, `chat-view.tsx`, `cron-view.tsx`
**Effort:** 1 day

### 12. Sparkline Micro-Charts on Stat Cards
**Why:** Numbers without trend context are meaningless. This separates Vercel-quality from a status page.
**How:** 10-point ring buffer in `useRef`, render as tiny SVG path under each stat number.
**Files:** `dashboard-view.tsx` (StatCard)
**Effort:** 4-6 hours

### 13. Real-Time Cost Attribution ($$$)
**Why:** Token counts are meaningless without prices. Need per-agent USD cost, monthly budget tracker, anomaly alerts.
**How:** Model pricing table + aggregate from usage data. Dashboard top bar: "This month: $X / Budget: $Y".
**Files:** `usage-view.tsx`, `dashboard-view.tsx`, new pricing config
**Effort:** 1-2 days
**Inspiration:** Helicone

### 14. Live Agent Activity in Sidebar
**Why:** Sidebar is always visible. Showing "2 agents active" or "Daily Brief running..." gives true mission control feel.
**Files:** `sidebar.tsx`, new `agent-activity-store.ts`
**Effort:** 4-6 hours

### 15. Context-Aware Section Header
**Why:** Topbar always shows "Mission Control". Should show section name + key metadata + quick CTA.
**Files:** `header.tsx`, `page.tsx`
**Effort:** 4-6 hours

### 16. Proactive Alert Delivery (Webhooks/Telegram)
**Why:** Current issues panel is passive — you must be looking at the dashboard. For autonomous agents, silent failures are invisible.
**How:** Configurable alert rules → webhook POST, Telegram message when thresholds breach.
**Files:** New `api/alerts/route.ts`, alert config UI, notification dispatcher
**Effort:** 2-3 days
**Inspiration:** Grafana alerting + PagerDuty

### 17. Cookie-Based Auth (replace URL token)
**Why:** Token in URL appears in server logs, Referer headers, browser history. Exchange token for httpOnly cookie on first visit.
**Files:** `auth.ts`, new `middleware.ts`, `layout.tsx` script
**Effort:** 4-6 hours

### 18. Split agents-view.tsx (3,358 lines)
**Why:** 108 hooks in one file. Unmaintainable. Editor/graph/list/model-selector should be separate components.
**How:** Decompose into `src/components/agents/` directory.
**Files:** `agents-view.tsx` → 6-8 files
**Effort:** 1-2 days

### 19. usePolling Hook (standardize)
**Why:** Each component rolls its own polling with different visibility handling, error backoff, cleanup. A shared hook fixes all bugs in one place.
**Files:** New `use-polling.ts`, refactor 8+ components
**Effort:** 2-3 hours

---

## Moonshots (ambitious, high-impact)

### 20. Agent Execution Trace / Waterfall View
**Why:** When an agent takes 45s, need to know which step was slow. Per-turn breakdown: LLM call → tool calls → sub-agent spawns → completion with duration and cost per step.
**Inspiration:** LangSmith waterfall traces
**Effort:** 3-5 days (needs backend tracing)

### 21. Live Service Map with Edge Metrics
**Why:** Agent ReactFlow graph already exists but edges are static topology. Upgrade so edges show live traffic volume (thickness), error rate (color), latency (tooltip).
**Inspiration:** Datadog Service Map
**Effort:** 2-3 days (data pipeline + ReactFlow edge customization)

### 22. Structured Activity Feed (replace raw logs)
**Why:** Raw `[gateway] connection closed` logs tell nothing useful. Need: agent avatar, event type pill, delta time, expandable detail. Categorized and color-coded.
**Files:** New `activity-feed.tsx`, `dashboard-view.tsx`
**Effort:** 2-3 days

### 23. Customizable Dashboard Layouts
**Why:** Every operator has different priorities. Drag-and-drop widget arrangement, persisted per user.
**Inspiration:** Home Assistant Lovelace, Grafana panel layout
**Effort:** 3-5 days

### 24. Agent Activity Timeline / Swimlane View
**Why:** When multiple agents run simultaneously, no way to see parallelism, scheduling conflicts, or cascading failures across time.
**Inspiration:** Datadog timeline, Home Assistant automation traces
**Effort:** 3-5 days

### 25. Prompt/Identity Versioning with Diff View
**Why:** No way to know what changed between "agent worked" and "agent broke". Need version history, diff view, per-version metrics, rollback button.
**Inspiration:** Helicone prompt versioning, GitHub diff
**Effort:** 3-5 days

### 26. Mobile PWA Quality
**Why:** Service worker already registered but UI is desktop-first. Autonomous agents running 24/7 need mobile triage: bottom-nav, swipeable cards, push notifications.
**Inspiration:** Vercel mobile, Portainer mobile
**Effort:** 1-2 weeks

### 27. Floating Action Button for Agent Chat
**Why:** Persistent chat panel should be a premium FAB (fixed bottom-right, pulsing glow, unread badge) not a header button that gets lost.
**Files:** `header.tsx` (AgentChatPanel), `layout.tsx`
**Effort:** 4-6 hours

---

## Architecture Debt (fix alongside features)

| Issue | Impact | Fix |
|-------|--------|-----|
| 10+ independent polling loops | Performance, battery | Unified SSE bus (#10) |
| `/api/agents` fetched by 2 components independently | Wasted requests | Shared query cache (#11) |
| All 51 components are `"use client"` | Bundle size | Move static content to server components |
| Monaco/xterm/ReactFlow loaded on first paint | ~4MB wasted | Dynamic imports (#1) |
| agents-view.tsx: 3,358 lines, 108 hooks | Unmaintainable | Split into directory (#18) |
| Zero error boundaries beyond global | One crash kills all | Per-section boundaries (#3) |
| Auth token in URL query params | Security logs leak | Cookie exchange (#17) |
| No visibility-aware polling standard | Battery/network waste | usePolling hook (#19) |

---

## Suggested Build Order

```
Week 1: Quick Wins (#1-8) — visual polish, perceived performance
Week 2: Command Palette (#9) + SSE Bus (#10) + Query Cache (#11) — architecture
Week 3: Cost Attribution (#13) + Alert Delivery (#16) + Cookie Auth (#17)
Week 4: Sparklines (#12) + Activity Feed (#22) + Split agents-view (#18)
Month 2: Trace View (#20) + Service Map (#21) + Timeline (#24)
Month 3: Custom Layouts (#23) + Prompt Versioning (#25) + Mobile (#26)
```

---

*Generated 2026-02-22 by mc-brainstorm team (ux-agent + research-agent + arch-agent)*
