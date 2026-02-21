import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";

const TOKEN_PATH = process.env.DASHBOARD_TOKEN_PATH || join(homedir(), ".openclaw", "dashboard-token");

let _token: string | null = null;

export function getDashboardToken(): string {
  if (_token) return _token;

  try {
    _token = readFileSync(TOKEN_PATH, "utf-8").trim();
    if (_token) return _token;
  } catch {
    // File doesn't exist, generate new token
  }

  _token = randomUUID();
  const dir = TOKEN_PATH.substring(0, TOKEN_PATH.lastIndexOf("/"));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(TOKEN_PATH, _token + "\n", { mode: 0o600 });
  return _token;
}

export function verifyAuth(request: Request): boolean {
  const token = getDashboardToken();

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (bearerToken === token) return true;
  }

  // Check query param fallback (for EventSource/WebSocket)
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken === token) return true;

  return false;
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
