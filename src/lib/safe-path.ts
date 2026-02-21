import path from "path";

/**
 * Resolve a user-provided path safely within a base directory.
 * Returns null if the resolved path escapes the base directory.
 */
export function safePath(base: string, userPath: string): string | null {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(base, userPath);
  if (resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep)) {
    return resolved;
  }
  return null;
}
