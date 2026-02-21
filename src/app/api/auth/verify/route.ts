import { NextResponse } from "next/server";
import { verifyAuth, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return unauthorizedResponse();
  }
  return NextResponse.json({ ok: true, authenticated: true });
}
