/**
 * Lightweight pub/sub store for gateway restart-needed state.
 *
 * When any component changes config (cron edits, audio settings, etc.)
 * it calls `requestRestart()` to signal that a gateway restart is needed.
 * The global RestartAnnouncementBar subscribes and renders a prompt.
 *
 * Uses the same useSyncExternalStore pattern as chat-store.ts.
 */

type Listener = () => void;

let _restartNeeded = false;
let _reason = "";
let _restarting = false;
const _listeners = new Set<Listener>();

export function isRestartNeeded(): boolean {
  return _restartNeeded;
}

export function getRestartReason(): string {
  return _reason;
}

export function isRestarting(): boolean {
  return _restarting;
}

export function requestRestart(reason: string): void {
  if (_restartNeeded) return; // already showing
  _restartNeeded = true;
  _reason = reason;
  _restarting = false;
  _notify();
}

export function dismissRestart(): void {
  _restartNeeded = false;
  _reason = "";
  _restarting = false;
  _notify();
}

export function setRestarting(val: boolean): void {
  _restarting = val;
  _notify();
}

export function subscribeRestartStore(listener: Listener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** Snapshot function for useSyncExternalStore */
export function getRestartSnapshot(): {
  needed: boolean;
  reason: string;
  restarting: boolean;
} {
  return { needed: _restartNeeded, reason: _reason, restarting: _restarting };
}

function _notify(): void {
  for (const l of _listeners) {
    try {
      l();
    } catch {
      // ignore
    }
  }
}
