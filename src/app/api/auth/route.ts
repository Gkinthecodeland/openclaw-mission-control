import { NextRequest, NextResponse } from "next/server";
import { verifyPin, getAuthCookieValue, AUTH_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pin = String(body.pin || "").trim();

    if (!pin) {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }

    if (!verifyPin(pin)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, getAuthCookieValue(), {
      httpOnly: true,
      secure: false, // local network
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
