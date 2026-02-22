"use client";

import { useAutoRefresh } from "./use-auto-refresh";
import type { CrApiResponse } from "@/lib/cr-types";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = (await res.json()) as CrApiResponse<T>;
  if (json.error) throw new Error(json.error);
  return json.data;
}

export function useWorkspaceApi<T>(
  path: string,
  options?: { interval?: number; enabled?: boolean }
) {
  return useAutoRefresh(() => fetchApi<T>(path), options);
}
