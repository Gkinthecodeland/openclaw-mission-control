import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/intel/scanner";

export const dynamic = "force-dynamic";

/**
 * POST /api/intel/scan — Trigger a full intel scan.
 *
 * Body: { seedDays?: number } — default 1, use 7 for initial seed.
 * Idempotent: deduplication handles re-runs.
 */
export async function POST(request: NextRequest) {
  try {
    let seedDays = 1;

    try {
      const body = await request.json();
      if (body.seedDays && typeof body.seedDays === "number") {
        seedDays = body.seedDays;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    const stats = await runScan(seedDays);

    return NextResponse.json({ ok: true, seedDays, stats });
  } catch (err) {
    console.error("Intel scan error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
