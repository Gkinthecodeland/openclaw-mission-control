import { NextRequest } from "next/server";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { getOpenClawHome } from "@/lib/paths";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import { isCredentialKey } from "@/lib/redact";

export const dynamic = "force-dynamic";

const SAFE_ENV_KEYS = new Set([
  "PATH", "HOME", "SHELL", "TERM", "LANG", "USER", "EDITOR",
  "LC_ALL", "LC_CTYPE", "TMPDIR", "LOGNAME",
  "OPENCLAW_HOME", "OPENCLAW_CONFIG_PATH",
]);

const BLOCKED_ENV_PREFIXES = ["ANTHROPIC_", "DISCORD_", "OPENAI_", "GITHUB_TOKEN"];

function buildSafeEnv(): Record<string, string | undefined> {
  const env: Record<string, string> = {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    FORCE_COLOR: "3",
    LANG: "en_US.UTF-8",
    HOME: process.env.HOME || "/tmp",
    CLICOLOR: "1",
    CLICOLOR_FORCE: "1",
    NODE_ENV: process.env.NODE_ENV || "production",
    PATH: process.env.PATH || "/usr/bin:/bin",
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (SAFE_ENV_KEYS.has(key) || key.startsWith("XDG_")) {
      env[key] = value;
    } else if (isCredentialKey(key) || BLOCKED_ENV_PREFIXES.some(p => key.startsWith(p))) {
      continue; // strip credentials
    } else if (key.startsWith("OPENCLAW_") && !isCredentialKey(key)) {
      env[key] = value;
    }
  }
  return env;
}

/* ── Session store (module-level, persists across requests) ── */

type ShellSession = {
  proc: ChildProcessWithoutNullStreams;
  buffer: TerminalEvent[];
  created: number;
  lastActivity: number;
  cwd: string;
  alive: boolean;
  listeners: Set<(event: TerminalEvent) => void>;
};

type TerminalEvent =
  | { type: "output"; text: string }
  | { type: "status"; alive: boolean };

const sessions = new Map<string, ShellSession>();

const PY_PTY_BRIDGE = String.raw`import os, pty, select, signal, sys
shell = sys.argv[1] if len(sys.argv) > 1 else "/bin/zsh"
pid, fd = pty.fork()
if pid == 0:
  os.execvp(shell, [shell, "-i"])

stdin_open = True
child_alive = True

def _terminate(_signum, _frame):
  global child_alive
  if child_alive:
    try:
      os.kill(pid, signal.SIGTERM)
    except Exception:
      pass
    child_alive = False

signal.signal(signal.SIGTERM, _terminate)
signal.signal(signal.SIGINT, _terminate)

while True:
  fds = [fd]
  if stdin_open:
    fds.append(sys.stdin.fileno())

  try:
    r, _, _ = select.select(fds, [], [])
  except Exception:
    break

  if fd in r:
    try:
      data = os.read(fd, 4096)
    except OSError:
      break
    if not data:
      break
    os.write(sys.stdout.fileno(), data)

  if stdin_open and sys.stdin.fileno() in r:
    data = os.read(sys.stdin.fileno(), 4096)
    if not data:
      stdin_open = False
    else:
      os.write(fd, data)
`;

// Cleanup stale sessions every 5 minutes
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [id, s] of sessions) {
      // Kill sessions older than 30 minutes of inactivity, or dead ones
      if (!s.alive || now - s.lastActivity > 30 * 60 * 1000) {
        try { s.proc.kill(); } catch { /* */ }
        sessions.delete(id);
      }
    }
  };
  // Use a global flag to avoid re-registering
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.__terminalCleanup) {
    g.__terminalCleanup = setInterval(cleanup, 5 * 60 * 1000);
  }
}

function createSession(): string {
  const id = crypto.randomUUID().slice(0, 8);
  const home = getOpenClawHome();
  const shell = process.env.SHELL || "/bin/zsh";

  // Spawn a PTY bridge process so the shell has a real TTY.
  const proc = spawn("python3", ["-u", "-c", PY_PTY_BRIDGE, shell], {
    cwd: home,
    env: buildSafeEnv() as NodeJS.ProcessEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const session: ShellSession = {
    proc,
    buffer: [],
    created: Date.now(),
    lastActivity: Date.now(),
    cwd: home,
    alive: true,
    listeners: new Set(),
  };

  const pushEvent = (event: TerminalEvent) => {
    session.lastActivity = Date.now();
    // Keep last 5000 events in buffer for reconnection
    session.buffer.push(event);
    if (session.buffer.length > 5000) session.buffer.shift();
    // Notify all SSE listeners
    for (const fn of session.listeners) {
      try { fn(event); } catch { /* */ }
    }
  };

  proc.stdout.on("data", (data: Buffer) =>
    pushEvent({ type: "output", text: data.toString() })
  );
  proc.stderr.on("data", (data: Buffer) =>
    pushEvent({ type: "output", text: data.toString() })
  );

  proc.on("close", () => {
    session.alive = false;
    pushEvent({ type: "output", text: "\r\n\x1b[90m[Session ended]\x1b[0m\r\n" });
    pushEvent({ type: "status", alive: false });
  });

  proc.on("error", (err) => {
    session.alive = false;
    pushEvent({ type: "output", text: `\r\n\x1b[31m[Error: ${err.message}]\x1b[0m\r\n` });
    pushEvent({ type: "status", alive: false });
  });

  sessions.set(id, session);
  return id;
}

/* ── GET: SSE stream of terminal output ── */

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "stream";
  const sessionId = searchParams.get("session") || "";

  // List active sessions
  if (action === "list") {
    const list = [...sessions.entries()].map(([id, s]) => ({
      id,
      alive: s.alive,
      created: s.created,
      age: Math.round((Date.now() - s.created) / 1000),
    }));
    return Response.json({ sessions: list });
  }

  // SSE stream
  if (!sessionId || !sessions.has(sessionId)) {
    return Response.json({ error: "Invalid session" }, { status: 404 });
  }

  const session = sessions.get(sessionId)!;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send buffered output first (for reconnection)
      if (session.buffer.length > 0) {
        for (const event of session.buffer) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      }

      // Send alive status
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "status", alive: session.alive })}\n\n`)
      );

      // Listen for new output
      const listener = (event: TerminalEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          session.listeners.delete(listener);
        }
      };

      session.listeners.add(listener);

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        session.listeners.delete(listener);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ── POST: create session, send input, resize, kill ── */

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) return unauthorizedResponse();

  const body = await request.json();
  const action = body.action as string;

  switch (action) {
    case "create": {
      const activeSessions = [...sessions.values()].filter(s => s.alive).length;
      if (activeSessions >= 2) {
        return Response.json(
          { error: "Max concurrent sessions (2) reached. Kill an existing session first." },
          { status: 429 }
        );
      }
      const id = createSession();
      return Response.json({ ok: true, session: id });
    }

    case "input": {
      const sessionId = body.session as string;
      const data = body.data as string;
      const session = sessions.get(sessionId);
      if (!session || !session.alive) {
        return Response.json({ error: "Session not found or dead" }, { status: 404 });
      }
      session.proc.stdin.write(data);
      session.lastActivity = Date.now();
      return Response.json({ ok: true });
    }

    case "resize": {
      const sessionId = body.session as string;
      const cols = Number(body.cols);
      const rows = Number(body.rows);
      const session = sessions.get(sessionId);
      if (!session || !session.alive) {
        return Response.json({ error: "Session not found or dead" }, { status: 404 });
      }
      if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 2 || rows < 2) {
        return Response.json({ error: "Invalid cols/rows" }, { status: 400 });
      }
      // PTY bridge currently ignores explicit resize.
      return Response.json({ ok: true });
    }

    case "kill": {
      const sessionId = body.session as string;
      const session = sessions.get(sessionId);
      if (session) {
        try { session.proc.kill(); } catch { /* */ }
        sessions.delete(sessionId);
      }
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
