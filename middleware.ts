import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, auth API, health check, and static assets
  if (
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("mc-auth");
  const pinHash = process.env.MC_PIN_HASH;

  // If no PIN is configured, block all access (require explicit configuration)
  if (!pinHash) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!authCookie || authCookie.value !== pinHash) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
