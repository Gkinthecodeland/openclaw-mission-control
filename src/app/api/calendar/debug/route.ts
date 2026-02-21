import { NextResponse } from "next/server";
import {
  isOAuthConfigured,
  getStoredTokens,
  getAccessToken,
} from "@/lib/google-calendar";
import { join } from "path";
import { getOpenClawHome } from "@/lib/paths";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/debug
 * Shows whether Google Calendar OAuth is configured and if we have tokens.
 */
export async function GET(request: Request) {
  if (!verifyAuth(request)) return unauthorizedResponse();

  const hasClientId = Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim());
  const hasClientSecret = Boolean(process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim());
  const tokens = await getStoredTokens();
  let accessTokenOk = false;
  if (tokens) {
    try {
      const at = await getAccessToken();
      accessTokenOk = Boolean(at);
    } catch {
      accessTokenOk = false;
    }
  }
  return NextResponse.json({
    oauthConfigured: isOAuthConfigured(),
    hasClientId,
    hasClientSecret,
    tokenPath: join(getOpenClawHome(), "google-calendar-tokens.json"),
    openclawHome: getOpenClawHome(),
    hasStoredTokens: Boolean(tokens?.refresh_token),
    accessTokenWorks: accessTokenOk,
    hint: !hasClientId || !hasClientSecret
      ? "Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in .env (from Google Cloud Console OAuth 2.0 credentials)."
      : !tokens
        ? "No tokens yet. Click 'Connect Google Calendar' on the Calendar view."
        : !accessTokenOk
          ? "Tokens exist but refresh failed. Try reconnecting from the Calendar view."
          : null,
  });
}
