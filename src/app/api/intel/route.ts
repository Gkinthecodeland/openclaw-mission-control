import { NextRequest, NextResponse } from "next/server";
import { getEntries, getStats } from "@/lib/intel/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/intel — List intel feed entries with optional filters.
 *
 * Query params: source, category, rating, tier, limit (default 50), offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const source = params.get("source") || undefined;
    const category = params.get("category") || undefined;
    const rating = params.get("rating") || undefined;
    const tier = params.get("tier") ? Number(params.get("tier")) : undefined;
    const limit = params.get("limit") ? Number(params.get("limit")) : 50;
    const offset = params.get("offset") ? Number(params.get("offset")) : 0;

    const { entries, total } = getEntries({ source, category, rating, tier, limit, offset });
    const stats = getStats();

    return NextResponse.json({ entries, total, stats });
  } catch (err) {
    console.error("Intel API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
