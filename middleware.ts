import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, API health, and static assets
  if (
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("mc-auth");
  const pinHash = process.env.MC_PIN_HASH;

  // If no PIN is configured, allow access (dev mode)
  if (!pinHash) {
    return NextResponse.next();
  }

  if (!authCookie || authCookie.value !== pinHash) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
