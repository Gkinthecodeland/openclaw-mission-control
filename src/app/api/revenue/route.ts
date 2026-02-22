import { NextResponse } from "next/server";
import type { CrRevenueMetrics } from "@/lib/cr-types";

const fallback: CrRevenueMetrics = {
  mrr: 0, arr: 0, growth: 0, customers: 3, pipeline: 265000,
};

export async function GET() {
  return NextResponse.json({
    data: { metrics: fallback },
    timestamp: new Date().toISOString(),
  });
}
