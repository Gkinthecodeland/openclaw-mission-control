import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, writeFile, stat, unlink, rename, copyFile } from "fs/promises";
import { join, extname, basename } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDefaultWorkspaceSync } from "@/lib/paths";
import { runCli, runCliJson } from "@/lib/openclaw-cli";

const WORKSPACE = getDefaultWorkspaceSync();
const exec = promisify(execFile);

type VectorState = "indexed" | "stale" | "not_indexed" | "unknown";

type MemoryStatusRow = {
  status?: {
    workspaceDir?: string;
    dbPath?: string;
  };
};

async function getIndexedMemoryFiles(): Promise<Map<string, { mtime: number; size: number }> | null> {
  try {
    const statuses = await runCliJson<MemoryStatusRow[]>(["memory", "status"], 12000);
    const match = statuses.find((s) => s.status?.workspaceDir === WORKSPACE);
    const dbPath = match?.status?.dbPath;
    if (!dbPath) return null;

    const { stdout } = await exec("sqlite3", [
      dbPath,
      "select path, mtime, size from files where source='memory';",
    ]);

    const map = new Map<string, { mtime: number; size: number }>();
    for (const line of stdout.split("\n")) {
      const row = line.trim();
      if (!row) continue;
      const [path, mtimeRaw, sizeRaw] = row.split("|");
      if (!path || !mtimeRaw || !sizeRaw) continue;
      const name = basename(path);
      const mtime = Number(mtimeRaw);
      const size = Number(sizeRaw);
      if (!Number.isFinite(mtime) || !Number.isFinite(size)) continue;
      map.set(name, { mtime, size });
    }
    return map;
  } catch {
    return null;
  }
}

function resolveVectorState(
  indexed: Map<string, { mtime: number; size: number }> | null,
  entry: { name: string; mtime?: string; size?: number }
): VectorState {
  if (!indexed) return "unknown";
  const hit = indexed.get(entry.name);
  if (!hit) return "not_indexed";
  if (!entry.mtime || typeof entry.size !== "number") return "indexed";
  const fileMtime = new Date(entry.mtime).getTime();
  if (!Number.isFinite(fileMtime)) return "indexed";
  // SQLite stores fractional ms; tolerate tiny drift from FS/stat rounding.
  const mtimeClose = Math.abs(hit.mtime - fileMtime) <= 2;
  const sizeSame = hit.size === entry.size;
  return mtimeClose && sizeSame ? "indexed" : "stale";
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { file, content } = body;
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    if (file) {
      const safePath = String(file).replace(/\.\./g, "").replace(/^\/+/, "");
      if (!safePath.endsWith(".md")) {
        return NextResponse.json({ error: "invalid file" }, { status: 400 });
      }
      const fullPath = join(WORKSPACE, "memory", safePath);
      await writeFile(fullPath, content, "utf-8");
      const words = content.split(/\s+/).filter(Boolean).length;
      const size = Buffer.byteLength(content, "utf-8");
      return NextResponse.json({ ok: true, file: safePath, words, size });
    }
    const fullPath = join(WORKSPACE, "MEMORY.md");
    await writeFile(fullPath, content, "utf-8");
    const words = content.split(/\s+/).filter(Boolean).length;
    const size = Buffer.byteLength(content, "utf-8");
    return NextResponse.json({ ok: true, file: "MEMORY.md", words, size });
  } catch (err) {
    console.error("Memory PUT error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** DELETE a memory journal file */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file");
    if (!file) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const safePath = String(file).replace(/\.\./g, "").replace(/^\/+/, "");
    if (!safePath.endsWith(".md")) {
      return NextResponse.json({ error: "invalid file" }, { status: 400 });
    }
    const fullPath = join(WORKSPACE, "memory", safePath);
    const s = await stat(fullPath);
    if (!s.isFile()) {
      return NextResponse.json({ error: "not a file" }, { status: 400 });
    }
    await unlink(fullPath);
    return NextResponse.json({ ok: true, file: safePath, deleted: true });
  } catch (err) {
    console.error("Memory DELETE error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** PATCH - rename or duplicate a memory journal file */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, file: fileName, newName } = body as {
      action: "rename" | "duplicate";
      file: string;
      newName?: string;
    };
    if (!fileName || !action) {
      return NextResponse.json({ error: "action and file required" }, { status: 400 });
    }
    const safePath = String(fileName).replace(/\.\./g, "").replace(/^\/+/, "");
    const fullPath = join(WORKSPACE, "memory", safePath);

    if (action === "rename") {
      if (!newName) {
        return NextResponse.json({ error: "newName required" }, { status: 400 });
      }
      const sanitized = newName.replace(/[/\\:*?"<>|]/g, "").trim();
      if (!sanitized) {
        return NextResponse.json({ error: "invalid name" }, { status: 400 });
      }
      const newFullPath = join(WORKSPACE, "memory", sanitized);
      await rename(fullPath, newFullPath);
      return NextResponse.json({ ok: true, file: sanitized, oldFile: safePath });
    }

    if (action === "duplicate") {
      const ext = extname(safePath);
      const base = basename(safePath, ext);
      let suffix = 1;
      let dupPath: string;
      do {
        dupPath = join(WORKSPACE, "memory", `${base} (copy${suffix > 1 ? ` ${suffix}` : ""})${ext}`);
        suffix++;
      } while (
        await stat(dupPath)
          .then(() => true)
          .catch(() => false)
      );
      await copyFile(fullPath, dupPath);
      const dupName = basename(dupPath);
      return NextResponse.json({ ok: true, file: dupName });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("Memory PATCH error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** POST - trigger memory indexing */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    if (action !== "index-memory") {
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
    }

    const file = typeof body.file === "string" ? body.file : null;
    const force = !!body.force;

    if (file) {
      const safePath = file.replace(/\.\./g, "").replace(/^\/+/, "");
      if (!safePath.endsWith(".md")) {
        return NextResponse.json({ error: "invalid file" }, { status: 400 });
      }
    }

    const args = ["memory", "index"];
    if (force) args.push("--force");
    await runCli(args, force ? 60000 : 30000);

    let vectorState: VectorState | undefined;
    if (file) {
      const safePath = file.replace(/\.\./g, "").replace(/^\/+/, "");
      try {
        const fullPath = join(WORKSPACE, "memory", safePath);
        const s = await stat(fullPath);
        const indexed = await getIndexedMemoryFiles();
        vectorState = resolveVectorState(indexed, {
          name: safePath,
          mtime: s.mtime.toISOString(),
          size: s.size,
        });
      } catch {
        vectorState = undefined;
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      file,
      vectorState,
      force,
    });
  } catch (err) {
    console.error("Memory POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");

  try {
    if (file) {
      const safePath = file.replace(/\.\./g, "").replace(/^\/+/, "");
      const fullPath = join(WORKSPACE, "memory", safePath);
      const content = await readFile(fullPath, "utf-8");
      const words = content.split(/\s+/).filter(Boolean).length;
      const size = Buffer.byteLength(content, "utf-8");
      return NextResponse.json({ content, words, size, file: safePath });
    }

    const memoryDir = join(WORKSPACE, "memory");
    const list: { name: string; date: string; size?: number; words?: number; mtime?: string }[] = [];
    try {
      const entries = await readdir(memoryDir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
        .sort()
        .reverse();

      for (const name of files.slice(0, 50)) {
        try {
          const fullPath = join(memoryDir, name);
          const content = await readFile(fullPath, "utf-8");
          const s = await stat(fullPath);
          const words = content.split(/\s+/).filter(Boolean).length;
          // Extract the date portion (YYYY-MM-DD) from filenames like 2026-02-14-1139.md
          const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : name.replace(".md", "");
          list.push({
            name,
            date,
            size: Buffer.byteLength(content, "utf-8"),
            words,
            mtime: s.mtime.toISOString(),
          });
        } catch {
          const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})/);
          list.push({ name, date: dateMatch ? dateMatch[1] : name.replace(".md", "") });
        }
      }
    } catch {
      // memory/ may not exist
    }

    let memoryMd: string | null = null;
    let memoryMtime: string | undefined;
    try {
      memoryMd = await readFile(join(WORKSPACE, "MEMORY.md"), "utf-8");
      const s = await stat(join(WORKSPACE, "MEMORY.md"));
      memoryMtime = s.mtime.toISOString();
    } catch {
      // MEMORY.md optional
    }

    const indexedFiles = await getIndexedMemoryFiles();
    const dailyWithVector = list.map((entry) => ({
      ...entry,
      vectorState: resolveVectorState(indexedFiles, entry),
    }));

    return NextResponse.json({
      daily: dailyWithVector,
      memoryMd: memoryMd
        ? {
            content: memoryMd,
            words: memoryMd.split(/\s+/).filter(Boolean).length,
            size: Buffer.byteLength(memoryMd, "utf-8"),
            mtime: memoryMtime,
          }
        : null,
    });
  } catch (err) {
    console.error("Memory API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
