/**
 * Intel Feed — SQLite database layer.
 *
 * Database lives at `data/intel.db` (auto-created).
 * Provides CRUD for intel_entries with deduplication by URL.
 */

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

// ── Types ──────────────────────────────────────────

export type IntelEntry = {
  id: number;
  url: string;
  title: string;
  source: string;
  source_tier: number;
  category: string | null;
  rating: string | null;
  summary: string | null;
  published_at: string | null;
  fetched_at: string;
  reviewed_at: string | null;
  raw_snippet: string | null;
  created_at: string;
};

export type InsertEntry = {
  url: string;
  title: string;
  source: string;
  sourceTier: number;
  category?: string | null;
  rawSnippet?: string | null;
  publishedAt?: string | null;
};

export type EntryFilters = {
  source?: string;
  category?: string;
  rating?: string;
  tier?: number;
  limit?: number;
  offset?: number;
};

export type EntryStats = {
  total: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  byRating: Record<string, number>;
};

// ── Database singleton ─────────────────────────────

const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "intel.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  mkdirSync(DB_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Create table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS intel_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      source_tier INTEGER DEFAULT 1,
      category TEXT,
      rating TEXT,
      summary TEXT,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      reviewed_at TEXT,
      raw_snippet TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Indexes
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_intel_source ON intel_entries(source)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_intel_category ON intel_entries(category)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_intel_rating ON intel_entries(rating)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_intel_published ON intel_entries(published_at)`);

  return _db;
}

// ── Queries ────────────────────────────────────────

/**
 * Insert an entry, skipping if URL already exists.
 * Returns true if inserted (new), false if skipped (duplicate).
 */
export function insertEntry(entry: InsertEntry): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO intel_entries (url, title, source, source_tier, category, raw_snippet, published_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const result = stmt.run(
    entry.url,
    entry.title,
    entry.source,
    entry.sourceTier,
    entry.category ?? null,
    entry.rawSnippet ?? null,
    entry.publishedAt ?? null,
  );
  return result.changes > 0;
}

/**
 * Query entries with optional filters.
 */
export function getEntries(filters: EntryFilters = {}): { entries: IntelEntry[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.source) {
    conditions.push("source = ?");
    params.push(filters.source);
  }
  if (filters.category) {
    conditions.push("category = ?");
    params.push(filters.category);
  }
  if (filters.rating) {
    conditions.push("rating = ?");
    params.push(filters.rating);
  }
  if (filters.tier) {
    conditions.push("source_tier = ?");
    params.push(filters.tier);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM intel_entries ${where}`).get(...params) as { cnt: number };
  const entries = db.prepare(
    `SELECT * FROM intel_entries ${where} ORDER BY published_at DESC, created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as IntelEntry[];

  return { entries, total: countRow.cnt };
}

/**
 * Get entries that haven't been reviewed by Jarvis yet.
 */
export function getUnratedEntries(): IntelEntry[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM intel_entries WHERE rating IS NULL OR rating = 'unrated' ORDER BY published_at DESC`
  ).all() as IntelEntry[];
}

/**
 * Update rating/summary/category for an entry (Jarvis annotation).
 */
export function updateRating(id: number, rating: string, summary: string | null, category?: string | null): void {
  const db = getDb();
  db.prepare(
    `UPDATE intel_entries SET rating = ?, summary = ?, category = COALESCE(?, category), reviewed_at = datetime('now') WHERE id = ?`
  ).run(rating, summary, category ?? null, id);
}

/**
 * Get aggregate stats.
 */
export function getStats(): EntryStats {
  const db = getDb();

  const totalRow = db.prepare("SELECT COUNT(*) as cnt FROM intel_entries").get() as { cnt: number };

  const sourceRows = db.prepare(
    "SELECT source, COUNT(*) as cnt FROM intel_entries GROUP BY source"
  ).all() as { source: string; cnt: number }[];

  const categoryRows = db.prepare(
    "SELECT COALESCE(category, 'uncategorized') as category, COUNT(*) as cnt FROM intel_entries GROUP BY category"
  ).all() as { category: string; cnt: number }[];

  const ratingRows = db.prepare(
    "SELECT COALESCE(rating, 'unrated') as rating, COUNT(*) as cnt FROM intel_entries GROUP BY rating"
  ).all() as { rating: string; cnt: number }[];

  const bySource: Record<string, number> = {};
  for (const r of sourceRows) bySource[r.source] = r.cnt;

  const byCategory: Record<string, number> = {};
  for (const r of categoryRows) byCategory[r.category] = r.cnt;

  const byRating: Record<string, number> = {};
  for (const r of ratingRows) byRating[r.rating] = r.cnt;

  return { total: totalRow.cnt, bySource, byCategory, byRating };
}
