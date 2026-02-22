/**
 * In-memory pub/sub for War Room events.
 * Multiplexes task updates, agent status changes, and activity events
 * through a single SSE stream per connected client.
 */

import type { WarRoomEvent } from "@/types/warroom";

const subscribers = new Set<(event: WarRoomEvent) => void>();

export function subscribeWarRoom(send: (event: WarRoomEvent) => void): () => void {
  subscribers.add(send);
  return () => subscribers.delete(send);
}

export function notifyWarRoom(event: WarRoomEvent): void {
  for (const send of subscribers) {
    try {
      send(event);
    } catch {
      subscribers.delete(send);
    }
  }
}

export function warRoomSubscriberCount(): number {
  return subscribers.size;
}
