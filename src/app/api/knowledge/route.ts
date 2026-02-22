import { NextResponse } from "next/server";
import { listWorkspaceFiles } from "@/lib/workspace-reader";
import type { CrKnowledgeFile } from "@/lib/cr-types";

const FALLBACK_FILES: CrKnowledgeFile[] = [
  { path: "IDENTITY.md", name: "IDENTITY.md", category: "core", size: 2400, lastModified: new Date().toISOString(), preview: "# Donna AI\nYou are Donna, an AI assistant..." },
  { path: "SOUL.md", name: "SOUL.md", category: "core", size: 4800, lastModified: new Date().toISOString(), preview: "# Soul Operations\nCore behavioral guidelines..." },
  { path: "AGENTS.md", name: "AGENTS.md", category: "core", size: 3200, lastModified: new Date().toISOString(), preview: "# Agent Registry\nActive agents and their roles..." },
  { path: "skills/email-triage.md", name: "email-triage.md", category: "skills", size: 1800, lastModified: new Date().toISOString(), preview: "# Email Triage\nProcess incoming emails..." },
  { path: "research/voice-ai.md", name: "voice-ai.md", category: "research", size: 6400, lastModified: new Date().toISOString(), preview: "# Voice AI Research\nCurrent state of voice..." },
  { path: "memory/active-tasks.md", name: "active-tasks.md", category: "memory", size: 900, lastModified: new Date().toISOString(), preview: "# Active Tasks\n- Deploy Mission Control..." },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase() ?? "";

  let files = await listWorkspaceFiles("", [".md"]);
  if (files.length === 0) {
    files = FALLBACK_FILES;
  }

  if (search) {
    files = files.filter(
      (f) =>
        f.name.toLowerCase().includes(search) ||
        f.category.toLowerCase().includes(search) ||
        (f.preview ?? "").toLowerCase().includes(search)
    );
  }

  return NextResponse.json({
    data: { files },
    timestamp: new Date().toISOString(),
  });
}
