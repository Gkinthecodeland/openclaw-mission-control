import { NextResponse } from "next/server";
import type { CrRepoInfo } from "@/lib/cr-types";

const fallback: CrRepoInfo[] = [
  { name: "openclaw-mission-control", path: "~/Desktop/Claude Code/openclaw-mission-control", branch: "main", lastCommit: "2h ago", lastCommitMessage: "Phase 1: Foundation", dirty: false, ahead: 0, behind: 0 },
  { name: "donna-ai", path: "~/donna-ai", branch: "main", lastCommit: "1d ago", lastCommitMessage: "Donna 2.0 deployment", dirty: false, ahead: 0, behind: 0 },
  { name: "achaiki-factory-os", path: "~/Desktop/Claude Code/Achaiki Pita OS/achaiki-factory-os", branch: "main", lastCommit: "3d ago", lastCommitMessage: "Sprint 7 HACCP closure", dirty: true, ahead: 2, behind: 0 },
  { name: "achaiki-marketing-os", path: "~/Desktop/Claude Code/Achaiki Pita OS/achaiki-marketing-os", branch: "main", lastCommit: "5d ago", lastCommitMessage: "Sales OS v0.2.0", dirty: false, ahead: 0, behind: 0 },
];

export async function GET() {
  return NextResponse.json({
    data: { repos: fallback },
    timestamp: new Date().toISOString(),
  });
}
