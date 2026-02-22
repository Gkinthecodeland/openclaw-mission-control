import { NextResponse } from "next/server";
import type { CrContentItem } from "@/lib/cr-types";

const fallback: CrContentItem[] = [
  { id: "1", title: "OpenClaw Launch Announcement", type: "blog", status: "idea", author: "GK", tags: ["openclaw", "launch"], createdAt: new Date().toISOString() },
  { id: "2", title: "Donna AI Thread", type: "social", status: "drafting", author: "Donna", tags: ["twitter", "ai"], createdAt: new Date().toISOString() },
  { id: "3", title: "Weekly Builder Update", type: "email", status: "review", author: "GK", tags: ["newsletter"], createdAt: new Date().toISOString() },
  { id: "4", title: "Mission Control Demo Video", type: "video", status: "scheduled", author: "GK", tags: ["demo"], createdAt: new Date().toISOString() },
  { id: "5", title: "Agent Framework Comparison", type: "doc", status: "published", author: "Donna", tags: ["research"], createdAt: new Date().toISOString() },
];

export async function GET() {
  return NextResponse.json({
    data: { items: fallback },
    timestamp: new Date().toISOString(),
  });
}
