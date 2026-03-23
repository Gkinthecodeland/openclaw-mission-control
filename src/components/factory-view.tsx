"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  SectionBody,
  SectionHeader,
  SectionLayout,
} from "@/components/section-layout";
import {
  ShoppingCart,
  DollarSign,
  Clock,
  Factory,
  AlertTriangle,
  ShieldCheck,
  Package,
  Truck,
  Warehouse,
  ClipboardCheck,
  FileText,
  Activity,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// ── Types ───────────────────────────────────────────

type KPI = {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  batchesToday: number;
  batchesInProgress: number;
  inventoryAlerts: number;
  haccpViolations: number;
};

type SummaryData = {
  kpi: KPI;
  recentOrders: OrderRow[];
  recentBatches: BatchRow[];
  recentEvents: EventRow[];
};

type OrderRow = {
  id: number;
  customer_id: string;
  order_date: string;
  delivery_date: string;
  status: string;
  total: number;
  notes: string | null;
  source: string | null;
  external_ref: string | null;
  customer_name: string | null;
  items?: OrderItem[];
};

type OrderItem = {
  id: number;
  order_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_name: string | null;
};

type BatchRow = {
  id: number;
  date: string;
  target_pieces: number;
  completed_pieces: number;
  status: string;
  waste_pieces: number;
  notes: string | null;
  product_name: string | null;
};

type DeliveryRow = {
  id: number;
  route_name: string;
  date: string;
  driver: string | null;
  status: string;
  notes: string | null;
  order_ids: number[];
};

type InventoryRow = {
  id: number;
  material: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_point: number;
  last_updated: string | null;
};

type HaccpRow = {
  id: number;
  batch_id: number;
  ccp_type: string;
  reading_value: string;
  status: string;
  recorded_at: string;
  notes: string | null;
  batch_date: string | null;
  product_name: string | null;
};

type InvoiceRow = {
  id: number;
  order_id: number;
  type: string;
  amount: number;
  vat_rate: number;
  total: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  customer_name: string | null;
};

type EventRow = {
  id: number;
  event_type: string;
  data_json: string;
  source_agent: string;
  created_at: string;
};

type TabKey =
  | "overview"
  | "orders"
  | "production"
  | "deliveries"
  | "inventory"
  | "haccp"
  | "invoices";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Factory },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "production", label: "Production", icon: Package },
  { key: "deliveries", label: "Deliveries", icon: Truck },
  { key: "inventory", label: "Inventory", icon: Warehouse },
  { key: "haccp", label: "Quality (HACCP)", icon: ClipboardCheck },
  { key: "invoices", label: "Invoices", icon: FileText },
];

// ── Helpers ─────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  pass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "in progress": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  running: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  in_transit: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "in transit": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  overdue: "bg-red-500/15 text-red-400 border-red-500/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  fail: "bg-red-500/15 text-red-400 border-red-500/20",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/20",
  canceled: "bg-red-500/15 text-red-400 border-red-500/20",
};

function statusBadge(status: string) {
  const key = status.toLowerCase();
  const color = STATUS_COLORS[key] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        color
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
      <Package className="mb-2 h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Data fetching hook ──────────────────────────────

function useFactoryData<T>(view: string, refreshInterval = 30000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/factory?view=${view}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (mountedRef.current) {
        setData(json);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(String(err));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refetch: fetchData };
}

// ── KPI Card ────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          color
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────

function OverviewTab() {
  const { data, loading, error } = useFactoryData<SummaryData>("summary");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No data available" />;

  const { kpi, recentOrders, recentBatches, recentEvents } = data;

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={ShoppingCart}
          label="Total Orders"
          value={kpi.totalOrders}
          color="bg-blue-500/15 text-blue-400"
        />
        <KpiCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(kpi.totalRevenue)}
          color="bg-emerald-500/15 text-emerald-400"
        />
        <KpiCard
          icon={Clock}
          label="Pending Orders"
          value={kpi.pendingOrders}
          color="bg-amber-500/15 text-amber-400"
        />
        <KpiCard
          icon={Factory}
          label="Batches In Progress"
          value={kpi.batchesInProgress}
          color="bg-violet-500/15 text-violet-400"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Inventory Alerts"
          value={kpi.inventoryAlerts}
          color={
            kpi.inventoryAlerts > 0
              ? "bg-red-500/15 text-red-400"
              : "bg-emerald-500/15 text-emerald-400"
          }
        />
        <KpiCard
          icon={ShieldCheck}
          label="HACCP Violations"
          value={kpi.haccpViolations}
          color={
            kpi.haccpViolations > 0
              ? "bg-red-500/15 text-red-400"
              : "bg-emerald-500/15 text-emerald-400"
          }
        />
        <KpiCard
          icon={Package}
          label="Batches Today"
          value={kpi.batchesToday}
          color="bg-cyan-500/15 text-cyan-400"
        />
      </div>

      {/* Recent Orders */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Orders
        </h3>
        {recentOrders.length === 0 ? (
          <EmptyState message="No orders yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-3 py-2 font-medium text-muted-foreground">ID</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Customer</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Total</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border/20 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 font-mono text-muted-foreground">#{o.id}</td>
                    <td className="px-3 py-2 text-foreground">{o.customer_name ?? o.customer_id}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(o.order_date)}</td>
                    <td className="px-3 py-2 text-foreground">{formatCurrency(o.total)}</td>
                    <td className="px-3 py-2">{statusBadge(o.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Batches */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Production Batches
        </h3>
        {recentBatches.length === 0 ? (
          <EmptyState message="No production batches yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-3 py-2 font-medium text-muted-foreground">ID</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Product</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Progress</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((b) => {
                  const pct =
                    b.target_pieces > 0
                      ? Math.round((b.completed_pieces / b.target_pieces) * 100)
                      : 0;
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-border/20 transition-colors hover:bg-muted/20"
                    >
                      <td className="px-3 py-2 font-mono text-muted-foreground">#{b.id}</td>
                      <td className="px-3 py-2 text-foreground">{b.product_name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(b.date)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-violet-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{statusBadge(b.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Agent Events
        </h3>
        {recentEvents.length === 0 ? (
          <EmptyState message="No events yet" />
        ) : (
          <div className="space-y-1.5">
            {recentEvents.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-border/40 px-3 py-2 transition-colors hover:bg-muted/20"
              >
                <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {e.event_type}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70">
                      {e.source_agent}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {tryParsePayload(e.data_json)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground/60">
                  {formatDateTime(e.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function tryParsePayload(data_json: string): string {
  try {
    const obj = JSON.parse(data_json);
    if (typeof obj === "object" && obj !== null) {
      return obj.summary || obj.message || obj.text || JSON.stringify(obj);
    }
    return String(obj);
  } catch {
    return data_json || "—";
  }
}

// ── Orders Tab ──────────────────────────────────────

function OrdersTab() {
  const { data, loading, error } = useFactoryData<OrderRow[]>("orders");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No orders found" />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="w-8 px-3 py-2" />
            <th className="px-3 py-2 font-medium text-muted-foreground">ID</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Customer</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Order Date</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Delivery Date</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Total</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Source</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((o) => {
            const isExpanded = expandedId === o.id;
            return (
              <OrderTableRow
                key={o.id}
                order={o}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : o.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderTableRow({
  order: o,
  isExpanded,
  onToggle,
}: {
  order: OrderRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border/20 transition-colors hover:bg-muted/20"
        onClick={onToggle}
      >
        <td className="px-3 py-2">
          {o.items && o.items.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : null}
        </td>
        <td className="px-3 py-2 font-mono text-muted-foreground">#{o.id}</td>
        <td className="px-3 py-2 text-foreground">{o.customer_name ?? o.customer_id}</td>
        <td className="px-3 py-2 text-muted-foreground">{formatDate(o.order_date)}</td>
        <td className="px-3 py-2 text-muted-foreground">{formatDate(o.delivery_date)}</td>
        <td className="px-3 py-2 font-medium text-foreground">{formatCurrency(o.total)}</td>
        <td className="px-3 py-2 text-muted-foreground">{o.source ?? "—"}</td>
        <td className="px-3 py-2">{statusBadge(o.status)}</td>
      </tr>
      {isExpanded && o.items && o.items.length > 0 && (
        <tr className="border-b border-border/20 bg-muted/10">
          <td colSpan={8} className="px-6 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground/70">
                  <th className="pb-1 text-left font-medium">Product</th>
                  <th className="pb-1 text-right font-medium">Qty</th>
                  <th className="pb-1 text-right font-medium">Unit Price</th>
                  <th className="pb-1 text-right font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id} className="text-muted-foreground">
                    <td className="py-0.5 text-foreground">{item.product_name ?? "—"}</td>
                    <td className="py-0.5 text-right">{item.quantity}</td>
                    <td className="py-0.5 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-0.5 text-right font-medium text-foreground">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Production Tab ──────────────────────────────────

function ProductionTab() {
  const { data, loading, error } = useFactoryData<BatchRow[]>("production");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No production batches found" />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="px-3 py-2 font-medium text-muted-foreground">ID</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Product</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Target</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Completed</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Progress</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Waste</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => {
            const pct =
              b.target_pieces > 0
                ? Math.round((b.completed_pieces / b.target_pieces) * 100)
                : 0;
            const wastePct =
              b.target_pieces > 0
                ? ((b.waste_pieces / b.target_pieces) * 100).toFixed(1)
                : "0.0";
            return (
              <tr
                key={b.id}
                className="border-b border-border/20 transition-colors hover:bg-muted/20"
              >
                <td className="px-3 py-2 font-mono text-muted-foreground">#{b.id}</td>
                <td className="px-3 py-2 text-foreground">{b.product_name ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(b.date)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {b.target_pieces.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {b.completed_pieces.toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct >= 100 ? "bg-emerald-500" : "bg-violet-500"
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "text-muted-foreground",
                      Number(wastePct) > 5 && "text-red-400"
                    )}
                  >
                    {wastePct}%
                  </span>
                </td>
                <td className="px-3 py-2">{statusBadge(b.status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Deliveries Tab ──────────────────────────────────

function DeliveriesTab() {
  const { data, loading, error } = useFactoryData<DeliveryRow[]>("deliveries");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No deliveries found" />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="px-3 py-2 font-medium text-muted-foreground">ID</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Route</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Driver</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Orders</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr
              key={d.id}
              className="border-b border-border/20 transition-colors hover:bg-muted/20"
            >
              <td className="px-3 py-2 font-mono text-muted-foreground">#{d.id}</td>
              <td className="px-3 py-2 text-foreground">{d.route_name}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(d.date)}</td>
              <td className="px-3 py-2 text-foreground">{d.driver ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {d.order_ids.length > 0
                  ? d.order_ids.map((id) => `#${id}`).join(", ")
                  : "—"}
              </td>
              <td className="px-3 py-2">{statusBadge(d.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Inventory Tab ───────────────────────────────────

function InventoryTab() {
  const { data, loading, error } = useFactoryData<InventoryRow[]>("inventory");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No inventory items found" />;

  const maxQuantity = Math.max(...data.map((i) => i.quantity), 1);

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="px-3 py-2 font-medium text-muted-foreground">Material</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Category</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Quantity</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Level</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Reorder Point</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const isLow = item.quantity < item.reorder_point;
            const barPct = Math.round((item.quantity / maxQuantity) * 100);
            return (
              <tr
                key={item.id}
                className={cn(
                  "border-b border-border/20 transition-colors hover:bg-muted/20",
                  isLow && "bg-red-500/5"
                )}
              >
                <td className="px-3 py-2 font-medium text-foreground">{item.material}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                <td className="px-3 py-2 text-foreground">
                  {item.quantity.toLocaleString()} {item.unit}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isLow ? "bg-red-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {item.reorder_point.toLocaleString()} {item.unit}
                </td>
                <td className="px-3 py-2">
                  {isLow ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── HACCP Tab ───────────────────────────────────────

function HaccpTab() {
  const { data, loading, error } = useFactoryData<HaccpRow[]>("haccp");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No HACCP readings recorded yet" />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="px-3 py-2 font-medium text-muted-foreground">ID</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Batch</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Product</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">CCP Type</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Reading</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Recorded</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((h) => (
            <tr
              key={h.id}
              className="border-b border-border/20 transition-colors hover:bg-muted/20"
            >
              <td className="px-3 py-2 font-mono text-muted-foreground">#{h.id}</td>
              <td className="px-3 py-2 text-muted-foreground">
                Batch #{h.batch_id}
                {h.batch_date && (
                  <span className="ml-1 text-muted-foreground/60">
                    ({formatDate(h.batch_date)})
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-foreground">{h.product_name ?? "—"}</td>
              <td className="px-3 py-2 text-foreground">{h.ccp_type}</td>
              <td className="px-3 py-2 font-mono text-foreground">{h.reading_value}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatDateTime(h.recorded_at)}
              </td>
              <td className="px-3 py-2">{statusBadge(h.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Invoices Tab ────────────────────────────────────

function InvoicesTab() {
  const { data, loading, error } = useFactoryData<InvoiceRow[]>("invoices");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No invoices found" />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="px-3 py-2 font-medium text-muted-foreground">ID</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Customer</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Order</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Type</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Amount</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">VAT</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Total</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Due Date</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-border/20 transition-colors hover:bg-muted/20"
            >
              <td className="px-3 py-2 font-mono text-muted-foreground">#{inv.id}</td>
              <td className="px-3 py-2 text-foreground">{inv.customer_name ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">#{inv.order_id}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{inv.type}</td>
              <td className="px-3 py-2 text-foreground">{formatCurrency(inv.amount)}</td>
              <td className="px-3 py-2 text-muted-foreground">{inv.vat_rate}%</td>
              <td className="px-3 py-2 font-medium text-foreground">
                {formatCurrency(inv.total)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(inv.due_date)}</td>
              <td className="px-3 py-2">{statusBadge(inv.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared UI ───────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/30" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-red-400">
      <AlertTriangle className="mb-2 h-8 w-8" />
      <p className="text-sm">Failed to load data</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────

export function FactoryView() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab key={lastRefresh} />;
      case "orders":
        return <OrdersTab key={lastRefresh} />;
      case "production":
        return <ProductionTab key={lastRefresh} />;
      case "deliveries":
        return <DeliveriesTab key={lastRefresh} />;
      case "inventory":
        return <InventoryTab key={lastRefresh} />;
      case "haccp":
        return <HaccpTab key={lastRefresh} />;
      case "invoices":
        return <InvoicesTab key={lastRefresh} />;
      default:
        return <OverviewTab key={lastRefresh} />;
    }
  };

  return (
    <SectionLayout>
      <SectionHeader
        title="Factory OS"
        description="Production, orders, inventory, and quality control"
        actions={
          <button
            type="button"
            onClick={() => setLastRefresh(Date.now())}
            className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />
      <SectionBody width="wide" padding="regular">
        {/* Tab navigation */}
        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border/40 pb-px">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                activeTab === key
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {renderTab()}
      </SectionBody>
    </SectionLayout>
  );
}
