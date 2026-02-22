"use client";

import { SectionLayout, SectionHeader, SectionBody } from "@/components/section-layout";
import { GlassCard } from "@/components/glass-card";
import { StaggerGrid } from "@/components/stagger-grid";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { CrRepoInfo } from "@/lib/cr-types";
import { GitBranch, GitCommit, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";

const FALLBACK_REPOS: CrRepoInfo[] = [
  { name: "openclaw-mission-control", path: "~/Desktop/Claude Code/openclaw-mission-control", branch: "main", lastCommit: "2h ago", lastCommitMessage: "Phase 1: Foundation", dirty: false, ahead: 0, behind: 0 },
  { name: "donna-ai", path: "~/donna-ai", branch: "main", lastCommit: "1d ago", lastCommitMessage: "Donna 2.0 deployment", dirty: false, ahead: 0, behind: 0 },
  { name: "achaiki-factory-os", path: "~/Desktop/Claude Code/Achaiki Pita OS/achaiki-factory-os", branch: "main", lastCommit: "3d ago", lastCommitMessage: "Sprint 7 HACCP closure", dirty: true, ahead: 2, behind: 0 },
  { name: "achaiki-marketing-os", path: "~/Desktop/Claude Code/Achaiki Pita OS/achaiki-marketing-os", branch: "main", lastCommit: "5d ago", lastCommitMessage: "Sales OS v0.2.0", dirty: false, ahead: 0, behind: 0 },
];

export function CodeView() {
  const { data } = useWorkspaceApi<{ repos: CrRepoInfo[] }>("/api/repos");
  const repos = data?.repos ?? FALLBACK_REPOS;

  return (
    <SectionLayout>
      <SectionHeader
        title="Code"
        description="Repository overview and git status"
      />
      <SectionBody width="wide" padding="regular">
        <StaggerGrid columns="grid-cols-1 sm:grid-cols-2">
          {repos.map((repo) => (
            <GlassCard key={repo.name} hover>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-semibold text-mc-text-primary truncate">
                      {repo.name}
                    </h3>
                    {repo.dirty && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-mc-status-warn" title="Uncommitted changes" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {repo.ahead > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-mc-status-ok">
                        <ArrowUp className="h-3 w-3" />{repo.ahead}
                      </span>
                    )}
                    {repo.behind > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-mc-status-error">
                        <ArrowDown className="h-3 w-3" />{repo.behind}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-mc-text-muted">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="font-mono">{repo.branch}</span>
                </div>

                <div className="flex items-start gap-2 text-xs text-mc-text-secondary">
                  <GitCommit className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span className="truncate">{repo.lastCommitMessage}</span>
                </div>

                <p className="text-xs text-mc-text-muted truncate font-mono">{repo.path}</p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-mc-text-muted">{repo.lastCommit}</span>
                  {repo.dirty && (
                    <span className="flex items-center gap-1 text-xs text-mc-status-warn">
                      <AlertCircle className="h-3 w-3" />
                      dirty
                    </span>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </StaggerGrid>
      </SectionBody>
    </SectionLayout>
  );
}
