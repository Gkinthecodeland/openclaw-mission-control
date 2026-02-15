import { NextRequest, NextResponse } from "next/server";
import { runCli, runCliJson, gatewayCall } from "@/lib/openclaw-cli";

export const dynamic = "force-dynamic";

type CronJob = {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; everyMs?: number; tz?: string };
  payload: { kind: string; message?: string };
  delivery: { mode: string; channel?: string; to?: string };
  state: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastError?: string;
  };
  sessionTarget?: string;
};

type CronList = { jobs: CronJob[] };

type CronRunEntry = {
  ts: number;
  jobId: string;
  action: string;
  status: string;
  summary?: string;
  durationMs?: number;
  error?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  nextRunAtMs?: number;
};

/**
 * Extract known delivery targets from sessions + existing cron jobs.
 * Session keys often follow the pattern `channel:chatId:agentId`.
 */
async function collectKnownTargets(): Promise<
  { target: string; channel: string; source: string }[]
> {
  const targets: Map<string, { channel: string; source: string }> = new Map();

  // 1. Extract from existing cron jobs
  try {
    const data = await runCliJson<CronList>(["cron", "list", "--all"]);
    for (const job of data.jobs || []) {
      if (job.delivery?.to) {
        const ch = job.delivery.channel || detectChannel(job.delivery.to);
        targets.set(job.delivery.to, { channel: ch, source: `cron: ${job.name}` });
      }
    }
  } catch {
    /* ignore */
  }

  // 2. Extract from active sessions (keys contain channel:id patterns)
  try {
    const data = await gatewayCall<{
      sessions: { key: string }[];
    }>("sessions.list", undefined, 10000);
    for (const sess of data.sessions || []) {
      const parsed = parseSessionKey(sess.key);
      if (parsed) {
        if (!targets.has(parsed.target)) {
          targets.set(parsed.target, { channel: parsed.channel, source: "active session" });
        }
      }
    }
  } catch {
    /* ignore */
  }

  return Array.from(targets.entries()).map(([target, info]) => ({
    target,
    channel: info.channel,
    source: info.source,
  }));
}

function detectChannel(to: string): string {
  if (to.startsWith("telegram:")) return "telegram";
  if (to.startsWith("discord:")) return "discord";
  if (to.startsWith("+")) return "whatsapp";
  return "";
}

function parseSessionKey(key: string): { target: string; channel: string } | null {
  // Session keys: "telegram:1386366527:main", "discord:123456:main", etc.
  const channels = ["telegram", "whatsapp", "discord"];
  for (const ch of channels) {
    if (key.startsWith(`${ch}:`)) {
      const parts = key.split(":");
      if (parts.length >= 2 && parts[1]) {
        return { target: `${ch}:${parts[1]}`, channel: ch };
      }
    }
  }
  // WhatsApp sessions might start with +
  if (key.startsWith("+")) {
    const parts = key.split(":");
    if (parts[0]) {
      return { target: parts[0], channel: "whatsapp" };
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const jobId = searchParams.get("id");

  try {
    if (action === "runs" && jobId) {
      // Get run history for a specific job
      const limit = searchParams.get("limit") || "10";
      const stdout = await runCli(
        ["cron", "runs", "--id", jobId, "--limit", limit],
        10000
      );
      // Parse the output - it's JSON with "entries" array
      try {
        const data = JSON.parse(stdout) as { entries: CronRunEntry[] };
        return NextResponse.json(data);
      } catch {
        // Fallback: return raw text
        return NextResponse.json({ entries: [], raw: stdout });
      }
    }

    if (action === "targets") {
      // Collect known delivery targets from sessions + existing cron jobs
      const targets = await collectKnownTargets();
      return NextResponse.json({ targets });
    }

    // Default: list all jobs
    const data = await runCliJson<CronList>(["cron", "list", "--all"]);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Cron GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, ...params } = body as {
      action: string;
      id: string;
      [key: string]: unknown;
    };

    if (!action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    switch (action) {
      case "enable": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        await runCli(["cron", "enable", id]);
        return NextResponse.json({ ok: true, action: "enabled", id });
      }

      case "disable": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        await runCli(["cron", "disable", id]);
        return NextResponse.json({ ok: true, action: "disabled", id });
      }

      case "run": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        await runCli(["cron", "run", id, "--force"], 30000);
        return NextResponse.json({ ok: true, action: "triggered", id });
      }

      case "delete": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        await runCli(["cron", "rm", id]);
        return NextResponse.json({ ok: true, action: "deleted", id });
      }

      case "edit": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const args = ["cron", "edit", id];
        if (params.name) args.push("--name", String(params.name));
        if (params.message) args.push("--message", String(params.message));
        if (params.cron) args.push("--cron", String(params.cron));
        if (params.every) args.push("--every", String(params.every));
        if (params.tz) args.push("--tz", String(params.tz));
        if (params.channel) args.push("--channel", String(params.channel));
        if (params.to) args.push("--to", String(params.to));
        if (params.model) args.push("--model", String(params.model));
        if (params.announce === true) args.push("--announce");
        if (params.announce === false) args.push("--no-deliver");
        await runCli(args, 10000);
        return NextResponse.json({ ok: true, action: "edited", id });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Cron POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
