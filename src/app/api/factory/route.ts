import { NextRequest, NextResponse } from "next/server";
import path from "path";
import os from "os";
import Database from "better-sqlite3";

function getDb(): Database.Database {
  const dbPath =
    process.env.FACTORY_DB ||
    path.join(os.homedir(), "factory-os-data/factory.db");
  const db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

function safeGet<T>(db: Database.Database, sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

function safeAll<T>(db: Database.Database, sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

function getSummary(db: Database.Database) {
  const totalOrders =
    safeGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM orders")?.c ?? 0;
  const totalRevenue =
    safeGet<{ s: number }>(db, "SELECT COALESCE(SUM(total), 0) as s FROM orders")?.s ?? 0;
  const pendingOrders =
    safeGet<{ c: number }>(
      db,
      "SELECT COUNT(*) as c FROM orders WHERE LOWER(status) IN ('pending', 'confirmed')"
    )?.c ?? 0;
  const batchesToday =
    safeGet<{ c: number }>(
      db,
      "SELECT COUNT(*) as c FROM production_batches WHERE date = date('now')"
    )?.c ?? 0;
  const batchesInProgress =
    safeGet<{ c: number }>(
      db,
      "SELECT COUNT(*) as c FROM production_batches WHERE LOWER(status) IN ('in progress', 'in_progress', 'running')"
    )?.c ?? 0;
  const inventoryAlerts =
    safeGet<{ c: number }>(
      db,
      "SELECT COUNT(*) as c FROM inventory_items WHERE quantity < reorder_point"
    )?.c ?? 0;
  const haccpViolations =
    safeGet<{ c: number }>(
      db,
      "SELECT COUNT(*) as c FROM haccp_readings WHERE LOWER(status) NOT IN ('pass', 'ok')"
    )?.c ?? 0;

  const recentOrders = safeAll(
    db,
    `SELECT o.id, o.order_date, o.delivery_date, o.status, o.total,
            c.name as customer_name
     FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     ORDER BY o.created_at DESC
     LIMIT 5`
  );

  const recentBatches = safeAll(
    db,
    `SELECT pb.id, pb.date, pb.target_pieces, pb.completed_pieces, pb.status,
            pb.waste_pieces, p.name as product_name
     FROM production_batches pb
     LEFT JOIN products p ON pb.product_id = p.id
     ORDER BY pb.created_at DESC
     LIMIT 5`
  );

  const recentEvents = safeAll(
    db,
    `SELECT id, event_type, data_json, source_agent, created_at
     FROM agent_events
     ORDER BY created_at DESC
     LIMIT 10`
  );

  return {
    kpi: {
      totalOrders,
      totalRevenue,
      pendingOrders,
      batchesToday,
      batchesInProgress,
      inventoryAlerts,
      haccpViolations,
    },
    recentOrders,
    recentBatches,
    recentEvents,
  };
}

function getOrders(db: Database.Database, status?: string) {
  const where = status ? "WHERE LOWER(o.status) = LOWER(?)" : "";
  const params = status ? [status] : [];

  const orders = safeAll<Record<string, unknown>>(
    db,
    `SELECT o.id, o.customer_id, o.order_date, o.delivery_date, o.status,
            o.total, o.notes,
            c.name as customer_name
     FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     ${where}
     ORDER BY o.created_at DESC`,
    params
  );

  const allItems = safeAll<Record<string, unknown>>(
    db,
    `SELECT oi.id, oi.order_id, oi.quantity, oi.unit_price, oi.line_total,
            p.name as product_name
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id`
  );

  const itemsByOrder = new Map<unknown, Record<string, unknown>[]>();
  for (const item of allItems) {
    const oid = item.order_id;
    if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
    itemsByOrder.get(oid)!.push(item);
  }

  return orders.map((o) => ({
    ...o,
    items: itemsByOrder.get(o.id) || [],
  }));
}

function getProduction(db: Database.Database) {
  return safeAll(
    db,
    `SELECT pb.id, pb.date, pb.target_pieces, pb.completed_pieces, pb.status,
            pb.waste_pieces, pb.notes, p.name as product_name
     FROM production_batches pb
     LEFT JOIN products p ON pb.product_id = p.id
     ORDER BY pb.date DESC`
  );
}

function getDeliveries(db: Database.Database) {
  const deliveries = safeAll<Record<string, unknown>>(
    db,
    `SELECT d.id, d.route_name, d.date, d.driver, d.status, d.notes
     FROM deliveries d
     ORDER BY d.date DESC`
  );

  const allDeliveryItems = safeAll<Record<string, unknown>>(
    db,
    `SELECT di.delivery_id, di.order_id FROM delivery_items di`
  );

  const itemsByDelivery = new Map<unknown, unknown[]>();
  for (const di of allDeliveryItems) {
    const did = di.delivery_id;
    if (!itemsByDelivery.has(did)) itemsByDelivery.set(did, []);
    itemsByDelivery.get(did)!.push(di.order_id);
  }

  return deliveries.map((d) => ({
    ...d,
    order_ids: itemsByDelivery.get(d.id) || [],
  }));
}

function getInventory(db: Database.Database) {
  return safeAll(
    db,
    `SELECT id, material, category, quantity, unit, reorder_point, last_updated
     FROM inventory_items
     ORDER BY (CASE WHEN quantity < reorder_point THEN 0 ELSE 1 END), material`
  );
}

function getHaccp(db: Database.Database) {
  return safeAll(
    db,
    `SELECT h.id, h.batch_id, h.ccp_type, h.reading_value, h.status,
            h.recorded_at, h.notes, pb.date as batch_date,
            p.name as product_name
     FROM haccp_readings h
     LEFT JOIN production_batches pb ON h.batch_id = pb.id
     LEFT JOIN products p ON pb.product_id = p.id
     ORDER BY h.recorded_at DESC`
  );
}

function getInvoices(db: Database.Database) {
  return safeAll(
    db,
    `SELECT i.id, i.order_id, i.type, i.amount, i.vat_rate, i.total,
            i.status, i.due_date, i.paid_date,
            c.name as customer_name
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     ORDER BY i.created_at DESC`
  );
}

function getEvents(db: Database.Database) {
  return safeAll(
    db,
    `SELECT id, event_type, data_json, source_agent, created_at
     FROM agent_events
     ORDER BY created_at DESC
     LIMIT 50`
  );
}

function getLearning(db: Database.Database) {
  const stats = safeAll(
    db,
    `SELECT agent_id, task_type,
       COUNT(*) as total_runs,
       SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
       SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) as failures,
       ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
       ROUND(AVG(duration_ms)) as avg_duration_ms,
       MAX(created_at) as last_run
     FROM agent_learnings
     GROUP BY agent_id, task_type
     ORDER BY total_runs DESC`
  );

  const recent = safeAll(
    db,
    `SELECT id, agent_id, task_type, complexity, outcome, duration_ms, error_message, created_at
     FROM agent_learnings ORDER BY created_at DESC LIMIT 30`
  );

  const overrides = safeAll(
    db,
    `SELECT * FROM routing_overrides WHERE active = 1 ORDER BY event_type`
  );

  return { stats, recent, overrides };
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get("view") || "summary";
  const status = request.nextUrl.searchParams.get("status") || undefined;

  let db: Database.Database | null = null;
  try {
    db = getDb();

    switch (view) {
      case "summary":
        return NextResponse.json(getSummary(db));
      case "orders":
        return NextResponse.json(getOrders(db, status));
      case "production":
        return NextResponse.json(getProduction(db));
      case "deliveries":
        return NextResponse.json(getDeliveries(db));
      case "inventory":
        return NextResponse.json(getInventory(db));
      case "haccp":
        return NextResponse.json(getHaccp(db));
      case "invoices":
        return NextResponse.json(getInvoices(db));
      case "events":
        return NextResponse.json(getEvents(db));
      case "learning":
        return NextResponse.json(getLearning(db));
      default:
        return NextResponse.json(
          { error: `Unknown view: ${view}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Factory API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    db?.close();
  }
}
