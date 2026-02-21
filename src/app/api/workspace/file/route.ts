import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { normalize } from "path";
import { getDefaultWorkspace } from "@/lib/paths";
import { safePath } from "@/lib/safe-path";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
]);

/**
 * GET /api/workspace/file?path=relative/path/to/file.png
 * Serves a single file from the workspace (e.g. for kanban task attachments).
 * Path must resolve within workspace root; path traversal is blocked.
 */
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const rawPath = (searchParams.get("path") || "").trim();
  if (!rawPath) {
    return NextResponse.json(
      { error: "Missing required query param: path" },
      { status: 400 }
    );
  }

  const normalized = normalize(rawPath).replace(/\\/g, "/");

  try {
    const workspace = await getDefaultWorkspace();
    const fullPath = safePath(workspace, normalized);
    if (!fullPath) {
      return NextResponse.json(
        { error: "Path traversal blocked" },
        { status: 403 }
      );
    }

    const content = await readFile(fullPath);

    const ext = normalized.toLowerCase().slice(normalized.lastIndexOf("."));
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const contentType = isImage
      ? (ext === ".svg"
          ? "image/svg+xml"
          : ext === ".ico"
            ? "image/x-icon"
            : ext === ".jpg"
              ? "image/jpeg"
              : `image/${ext.slice(1)}`)
      : "application/octet-stream";

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "File not found or not readable" },
      { status: 404 }
    );
  }
}
