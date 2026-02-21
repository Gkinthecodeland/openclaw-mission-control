"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const TOKEN_KEY = "mc-auth-token";

/**
 * Reads token from URL ?token= param, persists to sessionStorage,
 * and monkey-patches window.fetch to inject Authorization header
 * on all same-origin /api/* requests.
 */
export function AuthProvider() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Grab token from URL or sessionStorage
    const urlToken = searchParams.get("token");
    if (urlToken) {
      sessionStorage.setItem(TOKEN_KEY, urlToken);
    }

    const token = urlToken || sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;

    // Patch fetch once
    if ((window.fetch as unknown as { __authed?: boolean }).__authed) return;

    const originalFetch = window.fetch;
    const patchedFetch: typeof window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : "";

      // Only inject on same-origin /api/ calls
      if (url.startsWith("/api/") || url.startsWith(window.location.origin + "/api/")) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }

      return originalFetch(input, init);
    };
    (patchedFetch as unknown as { __authed?: boolean }).__authed = true;
    window.fetch = patchedFetch;

    // Also patch WebSocket and EventSource for terminal/streaming
    patchWebSocket(token);
    patchEventSource(token);
  }, [searchParams]);

  return null;
}

/**
 * EventSource can't set custom headers. Append ?token= to /api/* URLs.
 */
function patchEventSource(token: string) {
  if (typeof window.EventSource === "undefined") return;
  if ((window.EventSource as unknown as { __authed?: boolean }).__authed) return;

  const OriginalEventSource = window.EventSource;
  const PatchedEventSource = function (
    url: string | URL,
    init?: EventSourceInit
  ) {
    let esUrl = typeof url === "string" ? url : url.href;
    if (esUrl.startsWith("/api/") || esUrl.includes("/api/")) {
      const separator = esUrl.includes("?") ? "&" : "?";
      esUrl = `${esUrl}${separator}token=${token}`;
    }
    return new OriginalEventSource(esUrl, init);
  } as unknown as typeof EventSource;

  PatchedEventSource.prototype = OriginalEventSource.prototype;
  Object.defineProperty(PatchedEventSource, "CONNECTING", { value: OriginalEventSource.CONNECTING });
  Object.defineProperty(PatchedEventSource, "OPEN", { value: OriginalEventSource.OPEN });
  Object.defineProperty(PatchedEventSource, "CLOSED", { value: OriginalEventSource.CLOSED });
  (PatchedEventSource as unknown as { __authed?: boolean }).__authed = true;
  window.EventSource = PatchedEventSource;
}

/**
 * WebSocket connections can't set custom headers, but our terminal
 * routes might use query params. Patch the constructor to append token.
 */
function patchWebSocket(token: string) {
  if ((window.WebSocket as unknown as { __authed?: boolean }).__authed) return;

  const OriginalWebSocket = window.WebSocket;
  const PatchedWebSocket = function (
    url: string | URL,
    protocols?: string | string[]
  ) {
    let wsUrl = typeof url === "string" ? url : url.href;
    // Append token to WebSocket URLs going to our API
    if (wsUrl.includes("/api/")) {
      const separator = wsUrl.includes("?") ? "&" : "?";
      wsUrl = `${wsUrl}${separator}token=${token}`;
    }
    return new OriginalWebSocket(wsUrl, protocols);
  } as unknown as typeof WebSocket;

  PatchedWebSocket.prototype = OriginalWebSocket.prototype;
  Object.defineProperty(PatchedWebSocket, "CONNECTING", { value: OriginalWebSocket.CONNECTING });
  Object.defineProperty(PatchedWebSocket, "OPEN", { value: OriginalWebSocket.OPEN });
  Object.defineProperty(PatchedWebSocket, "CLOSING", { value: OriginalWebSocket.CLOSING });
  Object.defineProperty(PatchedWebSocket, "CLOSED", { value: OriginalWebSocket.CLOSED });
  (PatchedWebSocket as unknown as { __authed?: boolean }).__authed = true;
  window.WebSocket = PatchedWebSocket;
}
