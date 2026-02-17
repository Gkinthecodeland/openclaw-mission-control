"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  MarkerType,
  type Edge,
  type Node,
  type Connection,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Save,
  Sparkles,
  Plus,
  Link2,
  GitBranch,
  Bot,
  Loader2,
  UploadCloud,
  AlertTriangle,
  Search,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineSpinner, LoadingState } from "@/components/ui/loading-state";

type GraphNodeData = {
  label: string;
  kind: string;
  summary: string;
  confidence: number;
  source: string;
  tags: string[];
};

type GraphEdgeData = {
  relation: string;
  weight: number;
  evidence: string;
};

type GraphNodePayload = {
  id: string;
  label: string;
  kind: string;
  summary: string;
  confidence: number;
  source: string;
  tags: string[];
  x: number;
  y: number;
};

type GraphEdgePayload = {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
  evidence: string;
};

type GraphPayload = {
  version: number;
  updatedAt: string;
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
};

type Notice = { kind: "success" | "error"; text: string } | null;

const KIND_OPTIONS = [
  "system",
  "profile",
  "person",
  "project",
  "topic",
  "fact",
  "task",
] as const;

function nodeStyle(kind: string, confidence = 0.75): React.CSSProperties {
  const map: Record<string, [number, number, number]> = {
    system: [56, 189, 248],
    profile: [168, 85, 247],
    person: [34, 197, 94],
    project: [244, 114, 182],
    topic: [251, 191, 36],
    fact: [99, 102, 241],
    task: [248, 113, 113],
  };
  const [r, g, b] = map[kind] || [148, 163, 184];
  const conf = Math.max(0, Math.min(1, confidence || 0));
  const bgAlpha = 0.12 + conf * 0.2;
  const glowAlpha = 0.1 + conf * 0.2;
  const borderAlpha = 0.12 + conf * 0.2;
  return {
    borderRadius: 14,
    border: `1px solid rgba(255,255,255,${borderAlpha})`,
    background: `linear-gradient(135deg, rgba(${r},${g},${b},${bgAlpha}) 0%, rgba(0,0,0,0.28) 100%)`,
    color: "#f4f4f5",
    fontSize: 12,
    minWidth: 180,
    opacity: 0.68 + conf * 0.32,
    boxShadow: `0 8px 26px rgba(0,0,0,0.26), 0 0 ${8 + Math.round(conf * 14)}px rgba(${r},${g},${b},${glowAlpha})`,
    padding: "10px 12px",
  };
}

function asFlowNodes(payloadNodes: GraphNodePayload[]): Node<GraphNodeData>[] {
  return payloadNodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      kind: n.kind,
      summary: n.summary,
      confidence: n.confidence,
      source: n.source,
      tags: Array.isArray(n.tags) ? n.tags : [],
    },
    style: nodeStyle(n.kind, n.confidence),
  }));
}

function asFlowEdges(payloadEdges: GraphEdgePayload[]): Edge<GraphEdgeData>[] {
  return payloadEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.relation,
    data: {
      relation: e.relation,
      weight: e.weight,
      evidence: e.evidence,
    },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: {
      stroke: "rgba(168,85,247,0.65)",
      strokeWidth: Math.max(1.5, Math.round((e.weight || 0.5) * 3)),
    },
  }));
}

function toPayload(nodes: Node<GraphNodeData>[], edges: Edge<GraphEdgeData>[]): GraphPayload {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({
      id: n.id,
      label: (n.data?.label || "Untitled").trim() || "Untitled",
      kind: (n.data?.kind || "fact").trim() || "fact",
      summary: (n.data?.summary || "").trim(),
      confidence: Math.max(0, Math.min(1, Number(n.data?.confidence ?? 0.75))),
      source: (n.data?.source || "manual").trim() || "manual",
      tags: Array.isArray(n.data?.tags) ? n.data.tags.filter(Boolean).slice(0, 8) : [],
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    })),
    edges: edges
      .filter((e) => e.source && e.target)
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        relation: String(e.data?.relation || e.label || "related_to").trim() || "related_to",
        weight: Math.max(0, Math.min(1, Number(e.data?.weight ?? 0.7))),
        evidence: String(e.data?.evidence || "").trim(),
      })),
  };
}

export function MemoryGraphView() {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge<GraphEdgeData>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      onNodesChangeBase(changes);
      if (changes.length) setDirty(true);
    },
    [onNodesChangeBase]
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      onEdgesChangeBase(changes);
      if (changes.length) setDirty(true);
    },
    [onEdgesChangeBase]
  );

  const loadGraph = useCallback(async (options?: { bootstrap?: boolean }) => {
    setLoading(true);
    try {
      const endpoint = options?.bootstrap
        ? "/api/memory/graph?mode=bootstrap"
        : "/api/memory/graph";
      const res = await fetch(endpoint);
      const data = await res.json();
      const graph = (data.graph || {}) as GraphPayload;
      setNodes(asFlowNodes(graph.nodes || []));
      setEdges(asFlowEdges(graph.edges || []));
      setDirty(Boolean(options?.bootstrap));
      if (options?.bootstrap && data.bootstrap) {
        const source =
          data.bootstrap.source === "indexed" ? "indexed vectors" : "filesystem markdown";
        const fileCount = Array.isArray(data.bootstrap.files) ? data.bootstrap.files.length : 0;
        setNotice({
          kind: "success",
          text: `Graph rebuilt from ${source} (${fileCount} files).`,
        });
      } else {
        setNotice(null);
      }
    } catch {
      setNotice({ kind: "error", text: "Failed to load memory graph." });
    } finally {
      setLoading(false);
    }
  }, [setEdges, setNodes]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) || null,
    [edges, selectedEdgeId]
  );

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => {
      const haystack = `${n.data.label} ${n.data.summary} ${n.data.kind} ${n.data.tags.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [nodes, query]);

  const handleSelectionChange = useCallback((sel: OnSelectionChangeParams) => {
    const nextNode = sel.nodes?.[0]?.id || null;
    const nextEdge = sel.edges?.[0]?.id || null;
    setSelectedNodeId(nextNode);
    setSelectedEdgeId(nextNode ? null : nextEdge);
  }, []);

  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`;
    const node: Node<GraphNodeData> = {
      id,
      position: { x: 260 + (nodes.length % 3) * 220, y: 120 + (nodes.length % 5) * 110 },
      data: {
        label: "New Memory",
        kind: "fact",
        summary: "",
        confidence: 0.75,
        source: "manual",
        tags: [],
      },
      style: nodeStyle("fact", 0.75),
    };
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setDirty(true);
  }, [nodes.length, setNodes]);

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const relation = "related_to";
      const next = addEdge(
        {
          id: `edge-${Date.now()}`,
          source: conn.source,
          target: conn.target,
          label: relation,
          data: { relation, weight: 0.7, evidence: "" },
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          style: { stroke: "rgba(168,85,247,0.65)", strokeWidth: 2 },
        },
        edges
      );
      setEdges(next);
      setDirty(true);
    },
    [edges, setEdges]
  );

  const autoLayout = useCallback(() => {
    const kindBuckets = new Map<string, Node<GraphNodeData>[]>();
    for (const node of nodes) {
      const kind = node.data.kind || "fact";
      if (!kindBuckets.has(kind)) kindBuckets.set(kind, []);
      kindBuckets.get(kind)!.push(node);
    }

    const kinds = [...kindBuckets.keys()];
    const next = nodes.map((n) => ({ ...n }));
    const byId = new Map(next.map((n) => [n.id, n]));

    kinds.forEach((kind, colIdx) => {
      const bucket = kindBuckets.get(kind) || [];
      bucket.forEach((node, rowIdx) => {
        const target = byId.get(node.id);
        if (!target) return;
        target.position = {
          x: 80 + colIdx * 310,
          y: 70 + rowIdx * 120,
        };
      });
    });

    setNodes(next);
    setDirty(true);
  }, [nodes, setNodes]);

  const updateSelectedNode = useCallback(
    (patch: Partial<GraphNodeData>) => {
      if (!selectedNodeId) return;
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const nextData = { ...n.data, ...patch };
          return { ...n, data: nextData, style: nodeStyle(nextData.kind, nextData.confidence) };
        })
      );
      setDirty(true);
    },
    [selectedNodeId, setNodes]
  );

  const updateSelectedEdge = useCallback(
    (patch: Partial<GraphEdgeData>) => {
      if (!selectedEdgeId) return;
      setEdges((prev) =>
        prev.map((e) => {
          if (e.id !== selectedEdgeId) return e;
          const nextData = { ...e.data, ...patch } as GraphEdgeData;
          return {
            ...e,
            data: nextData,
            label: nextData.relation,
            style: {
              ...e.style,
              strokeWidth: Math.max(1.5, Math.round((nextData.weight || 0.5) * 3)),
            },
          };
        })
      );
      setDirty(true);
    },
    [selectedEdgeId, setEdges]
  );

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
      setEdges((prev) =>
        prev.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
      );
      setSelectedNodeId(null);
      setDirty(true);
      return;
    }
    if (selectedEdgeId) {
      setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      setDirty(true);
    }
  }, [selectedEdgeId, selectedNodeId, setEdges, setNodes]);

  const saveGraph = useCallback(async () => {
    setSaving(true);
    try {
      const payload = toPayload(nodes, edges);
      const res = await fetch("/api/memory/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", graph: payload, reindex: true }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.graph) {
          setNodes(asFlowNodes(data.graph.nodes || []));
          setEdges(asFlowEdges(data.graph.edges || []));
        }
        setDirty(false);
        setNotice({ kind: "success", text: data.indexed ? "Graph saved and indexed." : "Graph saved." });
      } else {
        setNotice({ kind: "error", text: data.error || "Failed to save graph." });
      }
    } catch {
      setNotice({ kind: "error", text: "Failed to save graph." });
    } finally {
      setSaving(false);
    }
  }, [edges, nodes, setEdges, setNodes]);

  const publishSnapshot = useCallback(async () => {
    setPublishing(true);
    try {
      const payload = toPayload(nodes, edges);
      const res = await fetch("/api/memory/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-memory-md", graph: payload, reindex: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotice({
          kind: "success",
          text: data.indexed
            ? "Snapshot published to MEMORY.md and indexed."
            : "Snapshot published to MEMORY.md.",
        });
      } else {
        setNotice({ kind: "error", text: data.error || "Failed to publish snapshot." });
      }
    } catch {
      setNotice({ kind: "error", text: "Failed to publish snapshot." });
    } finally {
      setPublishing(false);
    }
  }, [edges, nodes]);

  const rebuildFromMemory = useCallback(async () => {
    setRebuilding(true);
    try {
      await loadGraph({ bootstrap: true });
    } finally {
      setRebuilding(false);
    }
  }, [loadGraph]);

  if (loading) {
    return <LoadingState label="Building memory graph..." className="min-h-0" />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-[290px] shrink-0 flex-col border-r border-foreground/[0.08] bg-card/60">
        <div className="space-y-3 border-b border-foreground/[0.06] p-3">
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={addNode}
              className="flex items-center justify-center gap-1 rounded-md border border-foreground/[0.08] bg-muted/40 px-2 py-1.5 text-foreground/80 transition-colors hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
              Add Node
            </button>
            <button
              type="button"
              onClick={autoLayout}
              className="flex items-center justify-center gap-1 rounded-md border border-foreground/[0.08] bg-muted/40 px-2 py-1.5 text-foreground/80 transition-colors hover:bg-muted"
            >
              <GitBranch className="h-3 w-3" />
              Auto Layout
            </button>
            <button
              type="button"
              onClick={rebuildFromMemory}
              disabled={rebuilding || saving || publishing}
              className="col-span-2 flex items-center justify-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Rebuild graph from indexed memory content"
            >
              {rebuilding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Rebuild from Memory
            </button>
            <button
              type="button"
              onClick={saveGraph}
              disabled={saving || !dirty}
              className="flex items-center justify-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/15 px-2 py-1.5 text-violet-200 transition-colors hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Graph
            </button>
            <button
              type="button"
              onClick={publishSnapshot}
              disabled={publishing}
              className="flex items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UploadCloud className="h-3 w-3" />
              )}
              Publish
            </button>
          </div>
        </div>

        <div className="border-b border-foreground/[0.06] p-3">
          <div className="flex items-center gap-2 rounded-md border border-foreground/[0.08] bg-card px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter entities..."
              className="w-full bg-transparent text-[12px] text-foreground/85 outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {filteredNodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setSelectedNodeId(n.id);
                setSelectedEdgeId(null);
              }}
              className={cn(
                "w-full rounded-md border px-2 py-1.5 text-left transition-colors",
                selectedNodeId === n.id
                  ? "border-violet-500/35 bg-violet-500/15"
                  : "border-foreground/[0.06] bg-card/40 hover:bg-card/80"
              )}
            >
              <p className="truncate text-[12px] font-medium text-foreground/90">{n.data.label}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                {n.data.kind} • {Math.round((n.data.confidence || 0.75) * 100)}%
              </p>
            </button>
          ))}
          {filteredNodes.length === 0 && (
            <div className="rounded-md border border-dashed border-foreground/[0.08] p-3 text-[11px] text-muted-foreground/60">
              No matching entities.
            </div>
          )}
        </div>
      </aside>

      <main className="relative min-h-0 flex-1 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,0.20),transparent_45%),radial-gradient(circle_at_80%_100%,rgba(14,165,233,0.16),transparent_40%)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onSelectionChange={handleSelectionChange}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          }}
          className="h-full w-full"
        >
          <Background gap={18} size={1} color="rgba(255,255,255,0.12)" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </main>

      <aside
        className={cn(
          "flex shrink-0 flex-col border-l border-foreground/[0.08] bg-card/60 transition-all duration-200",
          rightCollapsed ? "w-11" : "w-[320px]"
        )}
      >
        <div className="border-b border-foreground/[0.06] p-2">
          <div className={cn("flex items-center", rightCollapsed ? "justify-center" : "justify-between")}>
            {!rightCollapsed && (
              <p className="text-[12px] font-semibold text-foreground/85">Inspector</p>
            )}
            <div className="flex items-center gap-1">
              {!rightCollapsed && (selectedNode || selectedEdge) && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setRightCollapsed((v) => !v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-foreground/[0.08] bg-card text-muted-foreground transition-colors hover:text-foreground/80"
                title={rightCollapsed ? "Expand inspector" : "Collapse inspector"}
              >
                {rightCollapsed ? (
                  <ChevronLeft className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {rightCollapsed ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-1">
            <span className="select-none text-[10px] tracking-wide text-muted-foreground/70 [writing-mode:vertical-rl]">
              Inspector
            </span>
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {selectedNode ? (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-violet-300">
                <Bot className="h-3.5 w-3.5" />
                Entity Node
              </p>
              <label className="block text-[11px] text-muted-foreground/80">
                Label
                <input
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  className="mt-1 w-full rounded-md border border-foreground/[0.08] bg-card px-2 py-1.5 text-[12px] text-foreground/90 outline-none"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground/80">
                Kind
                <select
                  value={selectedNode.data.kind}
                  onChange={(e) => updateSelectedNode({ kind: e.target.value })}
                  className="mt-1 w-full rounded-md border border-foreground/[0.08] bg-card px-2 py-1.5 text-[12px] text-foreground/90 outline-none"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-muted-foreground/80">
                Summary
                <textarea
                  value={selectedNode.data.summary}
                  onChange={(e) => updateSelectedNode({ summary: e.target.value })}
                  rows={4}
                  className="mt-1 w-full resize-y rounded-md border border-foreground/[0.08] bg-card px-2 py-1.5 text-[12px] text-foreground/90 outline-none"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground/80">
                Confidence ({Math.round((selectedNode.data.confidence || 0) * 100)}%)
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedNode.data.confidence}
                  onChange={(e) =>
                    updateSelectedNode({ confidence: Number(e.target.value) })
                  }
                  className="mt-1 w-full accent-violet-400"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground/80">
                Tags (comma separated)
                <input
                  value={(selectedNode.data.tags || []).join(", ")}
                  onChange={(e) =>
                    updateSelectedNode({
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  className="mt-1 w-full rounded-md border border-foreground/[0.08] bg-card px-2 py-1.5 text-[12px] text-foreground/90 outline-none"
                />
              </label>
            </div>
          ) : selectedEdge ? (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-sky-300">
                <Link2 className="h-3.5 w-3.5" />
                Relationship Edge
              </p>
              <label className="block text-[11px] text-muted-foreground/80">
                Relation
                <input
                  value={selectedEdge.data?.relation || ""}
                  onChange={(e) => updateSelectedEdge({ relation: e.target.value })}
                  className="mt-1 w-full rounded-md border border-foreground/[0.08] bg-card px-2 py-1.5 text-[12px] text-foreground/90 outline-none"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground/80">
                Weight ({Math.round((selectedEdge.data?.weight || 0) * 100)}%)
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedEdge.data?.weight || 0.7}
                  onChange={(e) => updateSelectedEdge({ weight: Number(e.target.value) })}
                  className="mt-1 w-full accent-sky-400"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground/80">
                Evidence
                <textarea
                  value={selectedEdge.data?.evidence || ""}
                  onChange={(e) => updateSelectedEdge({ evidence: e.target.value })}
                  rows={4}
                  className="mt-1 w-full resize-y rounded-md border border-foreground/[0.08] bg-card px-2 py-1.5 text-[12px] text-foreground/90 outline-none"
                />
              </label>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-foreground/[0.12] bg-card/30 p-4 text-[12px] text-muted-foreground/70">
              <p className="flex items-center gap-1.5 font-medium text-foreground/80">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                Memory Graph Workflow
              </p>
              <p className="mt-2">
                Add entities, connect relationships, and encode stable knowledge as a graph.
              </p>
              <p className="mt-1">
                Save writes structured graph memory and materializes it into markdown for OpenClaw retrieval.
              </p>
              <p className="mt-1">
                Publish injects a high-signal snapshot into `MEMORY.md`.
              </p>
            </div>
          )}
        </div>
        )}
      </aside>

      {notice && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-lg border px-3 py-2 text-[12px] shadow-lg backdrop-blur-sm",
            notice.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
              : "border-red-500/30 bg-red-500/15 text-red-200"
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {notice.kind === "success" ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {notice.text}
          </span>
        </div>
      )}

      {(saving || publishing) && (
        <div className="pointer-events-none absolute right-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-md border border-foreground/[0.12] bg-card/90 px-2 py-1 text-[11px] text-foreground/80">
          <InlineSpinner size="sm" />
          {saving ? "Saving graph..." : "Publishing snapshot..."}
        </div>
      )}
    </div>
  );
}
