import { NextRequest } from "next/server";
import { subscribeWarRoom } from "@/lib/warroom-live";
import { subscribeKanban } from "@/lib/kanban-live";
import { verifyAuth, unauthorizedResponse } from "@/lib/auth";

/**
 * Multiplexed SSE stream for War Room.
 * Carries: task updates, agent status, activity events, kanban changes.
 */
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) return unauthorizedResponse();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; [key: string]: unknown }) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          cleanup();
        }
      };

      // Subscribe to War Room events
      const unsubWarRoom = subscribeWarRoom(send);

      // Also forward kanban events for backward compat
      const unsubKanban = subscribeKanban((event) => send(event));

      // Heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`)
          );
        } catch {
          cleanup();
        }
      }, 15000);

      function cleanup() {
        unsubWarRoom();
        unsubKanban();
        clearInterval(heartbeat);
      }

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
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
