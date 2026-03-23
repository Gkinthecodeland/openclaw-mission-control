import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { getOpenClawHome } from "@/lib/paths";

export const dynamic = "force-dynamic";

const OPENCLAW_HOME = getOpenClawHome();

type TranscriptEntry = {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      arguments?: Record<string, unknown>;
    }>;
  };
};

type ActivityItem = {
  time: string;
  type: "message" | "tool" | "image" | "exec" | "inbound";
  icon: string;
  text: string;
};

function parseActivity(entry: TranscriptEntry): ActivityItem | null {
  const msg = entry.message;
  if (!msg || !msg.content || !Array.isArray(msg.content)) return null;
  const time = entry.timestamp || "";

  if (msg.role === "assistant") {
    for (const c of msg.content) {
      if (c.type === "text" && c.text?.trim()) {
        const text = c.text.trim();
        if (["NO_REPLY", "HEARTBEAT_OK", "ANNOUNCE_SKIP"].includes(text)) return null;
        return { time, type: "message", icon: "🎬", text: text.slice(0, 500) };
      }
      if (c.type === "toolCall") {
        const name = c.name || "?";
        const args = (c.arguments || {}) as Record<string, string>;
        if (name === "message") {
          if (args.media || args.filePath) {
            const file = (args.media || args.filePath || "").split("/").pop();
            return { time, type: "image", icon: "📸", text: `Sent image: ${file} — ${(args.caption || "").slice(0, 150)}` };
          }
          if (args.message) {
            return { time, type: "message", icon: "💬", text: `Sent TG: ${args.message.slice(0, 200)}` };
          }
        }
        if (name === "exec") {
          return { time, type: "exec", icon: "⚙️", text: `Running: ${(args.command || "").slice(0, 200)}` };
        }
        return { time, type: "tool", icon: "🔧", text: `${name}(${JSON.stringify(args).slice(0, 150)})` };
      }
    }
  }

  if (msg.role === "user") {
    for (const c of msg.content) {
      if (c.type === "text" && c.text?.trim()) {
        const text = c.text.trim();
        if (["NO_REPLY", "HEARTBEAT_OK"].includes(text)) return null;
        return { time, type: "inbound", icon: "📩", text: text.slice(0, 300) };
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent") || "marketing-lead";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 200);

  try {
    // Read sessions.json to find the transcript file
    const sessionsPath = join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
    const sessionsData = JSON.parse(await readFile(sessionsPath, "utf-8"));
    
    // Find main session
    const mainKey = `agent:${agentId}:main`;
    const session = sessionsData[mainKey];
    if (!session?.sessionFile) {
      return NextResponse.json({ error: "No session found" }, { status: 404 });
    }

    // Read transcript
    const transcript = await readFile(session.sessionFile, "utf-8");
    const lines = transcript.trim().split("\n").filter(Boolean);
    
    // Parse recent entries
    const recentLines = lines.slice(-limit * 3); // read more to get enough activity
    const activities: ActivityItem[] = [];
    
    for (const line of recentLines) {
      try {
        const entry: TranscriptEntry = JSON.parse(line);
        const activity = parseActivity(entry);
        if (activity) activities.push(activity);
      } catch { /* skip unparseable lines */ }
    }

    const stats = {
      agentId,
      sessionFile: session.sessionFile,
      totalLines: lines.length,
      fileSizeKB: Math.round(transcript.length / 1024),
      lastUpdated: session.updatedAt || null,
    };

    return NextResponse.json({
      stats,
      activities: activities.slice(-limit),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to read agent transcript: ${err}` },
      { status: 500 }
    );
  }
}
