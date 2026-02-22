import { NextResponse } from "next/server";
import type { CrCommsDigest } from "@/lib/cr-types";

const fallback: CrCommsDigest[] = [
  { channel: "discord", messages: 45, lastActivity: "5m ago", highlights: ["Build monitor report completed", "Test suite all green", "New PR merged"] },
  { channel: "telegram", messages: 23, lastActivity: "10m ago", highlights: ["Server status check", "Task approval request", "Daily briefing sent"] },
];

export async function GET() {
  return NextResponse.json({
    data: { digests: fallback },
    timestamp: new Date().toISOString(),
  });
}
