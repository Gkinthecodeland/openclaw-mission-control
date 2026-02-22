# War Room — Implementation Blueprint

> Agent task Kanban + squad management + live feed + agent chat
> Synthesized from UX, Architecture, and Product brainstorm agents (2026-02-22)

---

## 1. What It Is

A unified **command center view** in Mission Control where an operator manages multiple AI agents through a Kanban board with real-time agent status, live activity feed, and inline communication. Think Agent16's War Room, but open-source, self-hosted, any-LLM.

**Name:** "War Room" (sidebar nav item, `?section=warroom`)

---

## 2. What Already Exists (Reuse)

| Concept | Existing | Status |
|---------|----------|--------|
| Kanban board | `tasks-view.tsx` — 4 columns, drag-drop, SSE live updates, inline add | Solid — extend, don't rewrite |
| Agent list | `agents-view.tsx` — ReactFlow graph, per-agent config | Too complex — build lightweight squad panel |
| Chat | `chat-view.tsx` — single-agent chat | Reuse as overlay/modal |
| Task API | `GET/PUT /api/tasks` — reads/writes `kanban.json`, SSE via `/api/tasks/stream` | Extend with PATCH + new actions |
| Agent API | `GET /api/agents` — merges CLI + config + gateway sessions | Use as-is for squad data |
| Live logs | `dashboard-view.tsx` — gateway log entries | Extract pattern for activity feed |
| Glow cards | `globals.css` — `.glow-critical`, `.glow-warning`, `.glow-active` | Reuse on task cards |

---

## 3. Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  WarRoomHeader: [War Room] [3 ACTIVE] [16 IN QUEUE] [Broadcast] │
├──────────────┬───────────────────────────┬───────────────────────┤
│  SquadPanel  │     KanbanBoard           │  LiveFeedPanel        │
│  w-60        │     flex-1 overflow-x     │  w-80                 │
│  (collapse   │     (horizontal scroll)   │  (collapse → w-0)     │
│   → w-10     │                           │                       │
│   icon strip)│                           │  └─ AgentChatOverlay  │
└──────────────┴───────────────────────────┴───────────────────────┘
```

- **CSS grid**: `grid-cols-[auto_1fr_auto]`
- Panels toggle collapsed via `transition-[width] duration-200`
- Mobile (`< lg`): single column, squad/feed become sheet overlays

---

## 4. Component Hierarchy

```
WarRoomView                          — root layout + state + SSE connection
├── WarRoomHeader                    — top bar with stats + mode toggles
│   ├── AgentCountBadge              — "3 AGENTS ACTIVE" + pulsing dot
│   ├── QueueStats                   — "16 IN QUEUE"
│   ├── BroadcastButton              — opens broadcast composer
│   └── PanelToggles                 — show/hide squad + feed panels
│
├── SquadPanel (left, w-60)          — who's working on what NOW
│   ├── SquadStats                   — N working, N idle mini row
│   └── AgentRoster (ScrollArea)
│       └── AgentRow[]               — avatar + status dot + name + role badge + workload bar
│
├── KanbanBoard (center, flex-1)     — the main board
│   ├── BulkActionBar                — appears when 2+ cards selected
│   └── KanbanColumns (flex, gap-3)
│       └── KanbanColumn[]           — one per status
│           ├── ColumnHeader          — dot + title + count + add button
│           ├── ColumnDropZone        — droppable, highlights on drag-over
│           │   └── TaskCard[]        — draggable cards
│           │       ├── UrgentBadge
│           │       ├── Title + Description (line-clamp)
│           │       ├── TagList (Badge pills)
│           │       ├── ProgressBar (in-progress only)
│           │       ├── Assignee (avatar + name)
│           │       ├── Date
│           │       └── HoverActions (assign/move/delete)
│           └── AddTaskButton
│
└── LiveFeedPanel (right, w-80)      — real-time activity stream
    ├── FeedTabs                     — All / Tasks / Decisions / Errors
    ├── FeedEventList (ScrollArea)
    │   └── FeedEvent[]              — icon + text + timestamp + agent avatar
    └── AgentChatOverlay
        ├── ChatTriggerBar           — collapsed: agent avatar strip
        └── MiniChatPanel            — expanded: select agent + message thread
```

---

## 5. Data Models

### Extended Task (backward-compatible)

```typescript
type Task = {
  // Existing (unchanged)
  id: number;
  title: string;
  description?: string;
  column: string;          // "backlog" | "in-progress" | "review" | "done"
  priority: "critical" | "high" | "medium" | "low";
  attachments?: string[];

  // New (all optional — zero migration needed)
  assignedAgent?: string;         // agent ID
  urgency?: "immediate" | "today" | "this-week" | "backlog";
  tags?: string[];                // ["seo", "research", "copywriting"]
  dueDate?: number;               // Unix ms
  estimatedMinutes?: number;
  actualMinutes?: number;
  completedAt?: number;           // Unix ms
  subtasks?: { id: string; title: string; done: boolean; doneAt?: number }[];
  sessionId?: string;             // linked gateway session
  createdAt?: number;             // Unix ms (backfill on first edit)
  updatedAt?: number;
  createdBy?: string;             // "human" | agent ID
};
```

### Squad (new file: `warroom-squads.json`)

```typescript
type Squad = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  members: {
    agentId: string;
    role: "lead" | "executor" | "reviewer" | "observer";
    capabilities: string[];
    maxConcurrentTasks: number;    // default 3
  }[];
};
```

### Activity Event (new file: `warroom-activity.jsonl`)

```typescript
type ActivityEvent = {
  id: string;
  timestamp: number;
  actor: "human" | string;        // agent ID
  action: "task.created" | "task.moved" | "task.assigned" | "task.completed"
        | "agent.online" | "agent.idle" | "broadcast.sent" | string;
  taskId?: number;
  agentId?: string;
  fromColumn?: string;
  toColumn?: string;
  meta?: Record<string, unknown>;
};
```

---

## 6. API Endpoints

### Extend Existing

```
GET  /api/tasks              — add query filters: ?assignedAgent=X&tag=Y&urgency=Z
PUT  /api/tasks              — unchanged (full state save)
POST /api/tasks              — new actions: "assign", "move", "complete"
```

### New: PATCH for atomic mutations

```
PATCH /api/tasks/[id]        — partial task update (no full-state PUT needed)
  Body: Partial<Task>
  → read kanban.json, find task, merge, write, emit SSE
```

### New: War Room endpoints

```
GET  /api/warroom/stream     — multiplexed SSE (all War Room events)
GET  /api/warroom/activity   — paginated activity log (?limit=50&before=ts)
POST /api/warroom/activity   — append event (agents call this)
GET  /api/warroom/squads     — list squads
POST /api/warroom/squads     — create squad
PUT  /api/warroom/squads/[id] — update squad
POST /api/warroom/broadcast  — send message to all/squad agents via gateway RPC
POST /api/warroom/message/[agentId] — direct message to agent
GET  /api/warroom/metrics    — computed metrics snapshot
GET  /api/warroom/workload   — per-agent task counts + capacity
```

---

## 7. Real-Time Architecture

### Single Multiplexed SSE Stream

`GET /api/warroom/stream` — one EventSource connection carries all event types:

```typescript
type WarRoomEvent =
  | { type: "task-created";   task: Task }
  | { type: "task-updated";   taskId: number; changes: Partial<Task> }
  | { type: "task-moved";     taskId: number; fromColumn: string; toColumn: string }
  | { type: "task-assigned";  taskId: number; agentId: string }
  | { type: "task-completed"; taskId: number }
  | { type: "agent-status";   agentId: string; status: "active"|"idle"|"unknown" }
  | { type: "activity";       event: ActivityEvent }
  | { type: "broadcast";      content: string; from: string }
  | { type: "metrics";        data: WarRoomMetrics }
  | { type: "ping" };
```

- **Heartbeat**: 15s ping
- **Metrics push**: every 10s while subscribers exist
- **Gateway bridge**: polls `fetchGatewaySessions()` every 15s, diffs agent statuses, emits `agent-status` events
- Bridge starts lazily on first subscriber, stops when count hits 0

### Drag-Drop Optimistic Updates

```
1. User drags card → set opacity-40 scale-95
2. Drop on column → optimistic: update local state immediately
3. PATCH /api/tasks/[id] { column: newColumn }
4. Success → remove from pending
5. Error → revert local state, show toast
6. SSE echo → skip if own pending move in-flight
```

---

## 8. Interactions

| Action | How |
|--------|-----|
| Move task | Drag card to column OR right-click → Move to → column |
| Assign agent | Drag card onto agent row in squad panel, OR hover → assign button |
| Filter by agent | Click agent row → dims unrelated cards (opacity-30) |
| Bulk select | Shift+click cards → bulk action bar appears |
| Broadcast | Click Broadcast button → composer modal → send to all/squad |
| Agent chat | Click agent avatar in feed panel → mini chat expands |
| New task | Click + in column header → inline form |
| Context menu | Right-click card → Move/Assign/Priority/Urgent/Delete |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New task in focused column |
| `F` | Toggle agent filter |
| `Esc` | Clear selection / close overlay |
| `Space` | Expand selected task details |

---

## 9. Metrics (War Room Header + future dashboard card)

### Operational
| KPI | Source |
|-----|--------|
| Tasks completed/day | Count tasks with `completedAt` in 24h window |
| Agent utilization % | Active session time / wall time |
| Avg completion time | `completedAt - createdAt` for done tasks |
| Stuck tasks | In Progress > 2h with no session heartbeat |
| Queue depth | Count of non-done tasks |

### Financial (Phase 2)
| KPI | Source |
|-----|--------|
| Cost per task | Session tokens × model price table |
| Total spend | Sum all task costs |
| Savings estimate | `(estimated_human_hours × hourly_rate) - actual_cost` |
| Cost by agent | Group cost per task by assignee |

---

## 10. File Structure

```
src/
├── app/api/
│   ├── tasks/
│   │   ├── route.ts              ← extend (new POST actions)
│   │   ├── [id]/route.ts         ← NEW: PATCH
│   │   └── stream/route.ts       ← unchanged
│   └── warroom/
│       ├── stream/route.ts       ← NEW: multiplexed SSE
│       ├── activity/route.ts     ← NEW: GET/POST
│       ├── squads/route.ts       ← NEW: CRUD
│       ├── broadcast/route.ts    ← NEW
│       ├── message/[agentId]/route.ts ← NEW
│       ├── metrics/route.ts      ← NEW
│       └── workload/route.ts     ← NEW
├── lib/
│   ├── warroom-live.ts           ← NEW: SSE pub/sub
│   ├── warroom-activity.ts       ← NEW: jsonl read/write
│   ├── warroom-squads.ts         ← NEW: squad CRUD
│   ├── warroom-broadcast.ts      ← NEW: gateway message delivery
│   ├── warroom-gateway-bridge.ts ← NEW: session diff → events
│   └── warroom-metrics.ts        ← NEW: metrics computation
├── types/
│   └── warroom.ts                ← NEW: all types
└── components/
    └── war-room/
        ├── war-room-view.tsx     ← main layout + stream
        ├── kanban-board.tsx      ← extended kanban
        ├── squad-panel.tsx       ← agent roster
        ├── live-feed.tsx         ← activity stream
        ├── broadcast-bar.tsx     ← message composer
        └── war-room-metrics.tsx  ← metrics header
```

Data files (workspace):
```
{workspace}/kanban.json              ← existing, schema extended
{workspace}/warroom-squads.json      ← new
{workspace}/warroom-activity.jsonl   ← new, append-only (trim to 1000)
```

---

## 11. MVP Scope (Phase 1 — 1 week)

### Ship This
1. **WarRoomView layout** — 3-panel grid with squad/kanban/feed
2. **Extended KanbanBoard** — reuse tasks-view logic, add: assignee avatar, tags, urgency badge, glow cards
3. **SquadPanel** — agent cards from `/api/agents` with real-time status dot (poll every 5s)
4. **LiveFeed** — filtered from existing SSE task events + gateway bridge agent-status
5. **PATCH /api/tasks/[id]** — atomic task mutations
6. **`/api/warroom/stream`** — multiplexed SSE
7. **Drag-assign** — drag task onto agent row to assign

### Skip for v1
- Broadcast messaging (needs gateway RPC integration)
- Squads CRUD (use all agents as one implicit squad)
- Metrics/ROI (just show counts in header)
- Agent chat overlay (open existing chat-view in modal)
- Subtasks
- Bulk actions
- Goal Tree

### Acceptance Criteria
- Operator sees all agents + tasks in one view
- Assign any task to any agent in < 3 clicks (drag or context menu)
- Agent status updates within 5s
- Zero new npm dependencies

---

## 12. Phase 2 (2 weeks after MVP)

1. Broadcast messaging via gateway RPC
2. Squad CRUD + squad panel management
3. Stuck task detection (configurable threshold)
4. Cost per task (token aggregation × price table)
5. Inline agent chat overlay
6. Task templates (Research, Code Review, Data Pull)
7. Filter/search bar on Kanban
8. Bulk actions (multi-select + move/assign/delete)

---

## 13. Phase 3 (Moonshots)

1. Auto-assign engine (agent capabilities × task skill tags)
2. Goal Tree (hierarchical task decomposition via ReactFlow)
3. Agent performance scoring (rework rate, completion time)
4. Predictive scheduling (duration estimates from history)
5. Multi-team War Rooms (namespaced boards per squad)

---

## 14. Competitive Edge vs Agent16

| | Agent16 | OpenClaw War Room |
|---|---------|-------------------|
| Hosting | Cloud-only | Self-hosted, air-gapped capable |
| LLM | Vendor-locked | Any model (Ollama local, OpenAI, Anthropic) |
| Data | Their servers | 100% local — GDPR by design |
| Price | SaaS subscription | Open-source, infrastructure cost only |
| Local inference | No | Yes — zero API cost agents |
| Custom roles | Fixed platform schema | YAML-defined agent taxonomy |
| Cron integration | No | Tasks can be recurring cron jobs |
| Privacy | Trust their cloud | All data on your hardware |

---

## 15. Key Design Decisions

1. **Single SSE stream** — fewer connections, simpler reconnect, one auth check
2. **jsonl for activity** — append-only writes, safe under concurrent access, easy to tail
3. **Optimistic drag-drop** — essential for snappy UX, pending map prevents SSE echo revert
4. **No WebSockets** — SSE is sufficient (server→client only), no socket.io dependency
5. **No new npm packages** — uses existing HTML5 drag, Radix UI, EventSource patterns
6. **Backward-compatible task schema** — all new fields optional, existing kanban.json loads unchanged
7. **Squad panel ≠ agents-view** — squad is operational focus (who's working NOW), agents-view is configuration
8. **Fixed panel widths** — collapse/expand, not resizable (avoids drag handle complexity)
9. **No database** — json/jsonl files, consistent with existing architecture

---

*Generated 2026-02-22 by kanban-brainstorm team (ux-agent + arch-agent + product-agent)*
