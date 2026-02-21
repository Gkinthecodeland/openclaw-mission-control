import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getRedirectUri, saveTokens } from "@/lib/google-calendar";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
export const dynamic = "force-dynamic";

/** GET /api/calendar/oauth/callback?code=... — exchange code for tokens, save, redirect to app. */
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  if (error) {
    const to = request.nextUrl.origin + "/?calendar_error=" + encodeURIComponent(error);
    return NextResponse.redirect(to);
  }
  if (!code) {
    return NextResponse.redirect(request.nextUrl.origin + "/?calendar_error=no_code");
  }
  const origin = request.headers.get("origin") || request.nextUrl.origin;
  const redirectUri = getRedirectUri(origin);
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    await saveTokens(tokens);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      request.nextUrl.origin + "/?calendar_error=" + encodeURIComponent(msg)
    );
  }
  return NextResponse.redirect(request.nextUrl.origin + "/?calendar_connected=1");
}
