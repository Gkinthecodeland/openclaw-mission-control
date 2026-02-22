import { cookies } from "next/headers";
import { createHash } from "crypto";

const AUTH_COOKIE = "mc-auth";
const PIN_HASH = process.env.MC_PIN_HASH || hashPin("0000"); // Default PIN: 0000

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export function verifyPin(pin: string): boolean {
  return hashPin(pin) === PIN_HASH;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE);
  return authCookie?.value === PIN_HASH;
}

export function getAuthCookieValue(): string {
  return PIN_HASH;
}

export const AUTH_COOKIE_NAME = AUTH_COOKIE;
