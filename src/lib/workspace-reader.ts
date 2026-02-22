import { readFile, readdir, stat } from "fs/promises";
import { join, resolve, relative, extname } from "path";
import type { CrWorkspaceFile, CrKnowledgeFile } from "./cr-types";

const DEFAULT_WORKSPACE = join(
  process.env.HOME || "/Users/gkagent",
  ".openclaw",
  "workspace"
);

function getWorkspacePath(): string {
  return process.env.WORKSPACE_PATH || DEFAULT_WORKSPACE;
}

function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = resolve(basePath);
  const resolvedTarget = resolve(targetPath);
  return resolvedTarget.startsWith(resolvedBase);
}

export async function readWorkspaceFile(
  relativePath: string
): Promise<CrWorkspaceFile | null> {
  const basePath = getWorkspacePath();
  const fullPath = join(basePath, relativePath);

  if (!isPathSafe(basePath, fullPath)) {
    console.error(`Path traversal blocked: ${relativePath}`);
    return null;
  }

  try {
    const content = await readFile(fullPath, "utf-8");
    const stats = await stat(fullPath);
    return {
      path: relativePath,
      name: relativePath.split("/").pop() || relativePath,
      content,
      lastModified: stats.mtime.toISOString(),
      size: stats.size,
    };
  } catch {
    return null;
  }
}

export async function listWorkspaceFiles(
  dir: string = "",
  extensions?: string[]
): Promise<CrKnowledgeFile[]> {
  const basePath = getWorkspacePath();
  const fullPath = join(basePath, dir);

  if (!isPathSafe(basePath, fullPath)) {
    return [];
  }

  const results: CrKnowledgeFile[] = [];

  try {
    const entries = await readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(fullPath, entry.name);
      const relPath = relative(basePath, entryPath);

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const subFiles = await listWorkspaceFiles(relPath, extensions);
        results.push(...subFiles);
      } else if (entry.isFile()) {
        if (extensions && !extensions.includes(extname(entry.name))) continue;
        try {
          const stats = await stat(entryPath);
          const content = await readFile(entryPath, "utf-8");
          results.push({
            path: relPath,
            name: entry.name,
            category: dir.split("/")[0] || "root",
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            preview: content.slice(0, 200),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return results;
}

export async function workspaceExists(): Promise<boolean> {
  try {
    await stat(getWorkspacePath());
    return true;
  } catch {
    return false;
  }
}
