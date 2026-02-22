import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { getOpenClawHome, getDefaultWorkspaceSync } from "@/lib/paths";
import { runCliJson, runCli } from "@/lib/openclaw-cli";
import { fetchGatewaySessions, summarizeSessionsByAgent } from "@/lib/gateway-sessions";

const OPENCLAW_HOME = getOpenClawHome();
export const dynamic = "force-dynamic";

type CliAgent = {
  id: string;
  name?: string;
  identityName?: string;
  identityEmoji?: string;
  identitySource?: string;
  workspace: string;
  agentDir: string;
  model: string;
  bindings: number;
  isDefault?: boolean;
  bindingDetails?: string[];
  routes?: string[];
};

type AgentFull = {
  id: string;
  name: string;
  emoji: string;
  model: string;
  fallbackModels: string[];
  workspace: string;
  agentDir: string;
  isDefault: boolean;
  sessionCount: number;
  lastActive: number | null;
  totalTokens: number;
  bindings: string[];
  channels: string[];
  identitySnippet: string | null;
  subagents: string[];
  runtimeSubagents: Array<{
    sessionKey: string;
    sessionId: string;
    shortId: string;
    model: string;
    totalTokens: number;
    lastActive: number;
    ageMs: number;
    status: "running" | "recent";
  }>;
  status: "active" | "idle" | "unknown";
  // Extended config fields
  toolsAllow: string[];
  toolsBlock: string[];
  a2aEnabled: boolean;
  a2aAllow: string[];
  heartbeat: { model?: string; interval?: number } | null;
  identityTheme: string | null;
};

const SUBAGENT_RECENT_WINDOW_MS = 30 * 60 * 1000;
const SUBAGENT_ACTIVE_WINDOW_MS = 2 * 60 * 1000;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function isSubagentSessionKey(key: string): boolean {
  return key.includes(":subagent:");
}

function shortSubagentId(key: string, sessionId: string): string {
  const fromKey = key.split(":").pop() || "";
  if (fromKey) return fromKey.slice(0, 8);
  return sessionId.slice(0, 8);
}

function connectedChannelsFromStatus(raw: unknown): Set<string> {
  const out = new Set<string>();
  const obj = asRecord(raw);
  const channels = asRecord(obj.channels);
  for (const [channel, rowRaw] of Object.entries(channels)) {
    const row = asRecord(rowRaw);
    const probe = asRecord(row.probe);
    if (row.running === true || probe.ok === true) {
      out.add(channel);
    }
  }

  const channelAccounts = asRecord(obj.channelAccounts);
  for (const [channel, entriesRaw] of Object.entries(channelAccounts)) {
    const entries = Array.isArray(entriesRaw) ? entriesRaw : [];
    for (const entryRaw of entries) {
      const entry = asRecord(entryRaw);
      const probe = asRecord(entry.probe);
      if (
        entry.running === true ||
        probe.ok === true
      ) {
        out.add(channel);
        break;
      }
    }
  }

  return out;
}

async function readJsonSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readTextSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Rich agent discovery — merges CLI data, config, sessions, identity.
 */
export async function GET() {
  try {
    // 1. Get agents from CLI (includes binding info)
    let cliAgents: CliAgent[] = [];
    try {
      cliAgents = await runCliJson<CliAgent[]>(
        ["agents", "list", "--bindings"],
        10000
      );
    } catch {
      // CLI might not be available
    }

    // 2. Get config for deeper info (models, subagents)
    const configPath = join(OPENCLAW_HOME, "openclaw.json");
    const config = await readJsonSafe<Record<string, unknown>>(configPath, {});
    const agentsConfig = (config.agents || {}) as Record<string, unknown>;
    const defaults = (agentsConfig.defaults || {}) as Record<string, unknown>;
    const configList = (agentsConfig.list || []) as Record<string, unknown>[];

    const defaultModel = defaults.model as Record<string, unknown> | undefined;
    const defaultPrimary = (defaultModel?.primary as string) || "unknown";
    const defaultFallbacks = (defaultModel?.fallbacks as string[]) || [];
    const defaultWorkspace =
      (defaults.workspace as string) || getDefaultWorkspaceSync();

    const discoveredDefaultAgentId =
      cliAgents.find((a) => a.isDefault)?.id ||
      (configList.find((c) => String(c.id || "") === "main")?.id as string | undefined) ||
      (configList.find((c) => typeof c.id === "string")?.id as string | undefined) ||
      "main";

    // Bindings in openclaw.json are the persisted routing truth.
    // Merge with CLI-reported bindings to avoid stale UI after recent edits.
    const configBindingsByAgent = new Map<string, string[]>();
    const configBindings = (config.bindings || []) as Record<string, unknown>[];
    for (const binding of configBindings) {
      const agentId = String(binding.agentId || discoveredDefaultAgentId).trim();
      const match = (binding.match || {}) as Record<string, unknown>;
      const channel = String(match.channel || "").trim();
      const accountId = String(match.accountId || "").trim();
      if (!channel) continue;
      const label = accountId ? `${channel} accountId=${accountId}` : channel;
      const existing = configBindingsByAgent.get(agentId) || [];
      if (!existing.includes(label)) existing.push(label);
      configBindingsByAgent.set(agentId, existing);
    }

    // Channels configured at instance level (whether bound or not).
    const configuredChannels = Object.entries(
      (config.channels || {}) as Record<string, unknown>
    ).map(([channel, rawCfg]) => {
      const channelCfg =
        rawCfg && typeof rawCfg === "object"
          ? (rawCfg as Record<string, unknown>)
          : {};
      return {
        channel,
        enabled: Boolean(channelCfg.enabled),
      };
    });

    const channelStatusRaw = await runCliJson<Record<string, unknown>>(
      ["channels", "status", "--probe"],
      12000
    ).catch(() => ({}));
    const connectedChannels = connectedChannelsFromStatus(channelStatusRaw);

    // Build a lookup from config list
    const configMap = new Map<string, Record<string, unknown>>();
    for (const c of configList) {
      if (c.id) configMap.set(c.id as string, c);
    }

    // Session state comes from gateway RPC (source of truth), not local files.
    let gatewaySessions = [] as Awaited<ReturnType<typeof fetchGatewaySessions>>;
    let sessionsByAgent = new Map<string, { sessionCount: number; totalTokens: number; lastActive: number }>();
    const runtimeSubagentsByAgent = new Map<
      string,
      AgentFull["runtimeSubagents"]
    >();
    try {
      gatewaySessions = await fetchGatewaySessions(10000);
      sessionsByAgent = summarizeSessionsByAgent(gatewaySessions);

      const now = Date.now();
      for (const session of gatewaySessions) {
        if (!isSubagentSessionKey(session.key)) continue;
        if (!session.agentId) continue;
        if (!session.updatedAt) continue;
        const ageMs = Math.max(0, now - session.updatedAt);
        if (ageMs > SUBAGENT_RECENT_WINDOW_MS) continue;
        const row: AgentFull["runtimeSubagents"][number] = {
          sessionKey: session.key,
          sessionId: session.sessionId,
          shortId: shortSubagentId(session.key, session.sessionId),
          model: session.fullModel || "unknown",
          totalTokens: session.totalTokens,
          lastActive: session.updatedAt,
          ageMs,
          status: ageMs <= SUBAGENT_ACTIVE_WINDOW_MS ? "running" : "recent",
        };
        const existing = runtimeSubagentsByAgent.get(session.agentId) || [];
        existing.push(row);
        runtimeSubagentsByAgent.set(session.agentId, existing);
      }

      for (const [agentId, rows] of runtimeSubagentsByAgent.entries()) {
        rows.sort((a, b) => b.lastActive - a.lastActive);
        runtimeSubagentsByAgent.set(agentId, rows.slice(0, 6));
      }
    } catch {
      // Keep agents page usable even if gateway session RPC is temporarily unavailable.
    }

    const agents: AgentFull[] = [];

    // Determine the set of agent ids to process
    const agentIds = new Set<string>();
    for (const cli of cliAgents) agentIds.add(cli.id);
    for (const cfg of configList) {
      if (cfg.id) agentIds.add(cfg.id as string);
    }
    for (const sessionAgentId of sessionsByAgent.keys()) {
      if (sessionAgentId) agentIds.add(sessionAgentId);
    }

    // Also scan agents directory
    try {
      const agentDirs = await readdir(join(OPENCLAW_HOME, "agents"), {
        withFileTypes: true,
      });
      for (const dir of agentDirs) {
        if (dir.isDirectory()) agentIds.add(dir.name);
      }
    } catch {
      // ok
    }

    for (const id of agentIds) {
      const cli = cliAgents.find((a) => a.id === id);
      const cfg = configMap.get(id) || {};

      // Name / emoji — strip markdown template hints like "_(or ...)"
      const rawName =
        cli?.identityName || (cfg.name as string) || cli?.name || id;
      const name = rawName.replace(/\s*_\(.*?\)_?\s*/g, "").trim() || rawName;
      const rawEmoji = cli?.identityEmoji || "🤖";
      const emoji = rawEmoji.replace(/\s*_\(.*?\)_?\s*/g, "").trim() || rawEmoji;

      // Model — prefer config-level names over CLI's resolved provider model IDs
      // (CLI returns the resolved model after auth failover, e.g. "amazon-bedrock/anthropic.claude-3-sonnet-..."
      //  which is not what the user configured)
      const agentModelCfg = cfg.model as
        | string
        | Record<string, unknown>
        | undefined;
      let model: string;
      let fallbackModels: string[];
      if (typeof agentModelCfg === "string") {
        // Per-agent model set as a plain string
        model = agentModelCfg;
        fallbackModels = defaultFallbacks;
      } else if (agentModelCfg && typeof agentModelCfg === "object") {
        // Per-agent model set as { primary, fallbacks }
        model = (agentModelCfg.primary as string) || defaultPrimary;
        fallbackModels = (agentModelCfg.fallbacks as string[]) || defaultFallbacks;
      } else {
        // No per-agent override — use the configured defaults (NOT the CLI resolved model)
        model = defaultPrimary;
        fallbackModels = defaultFallbacks;
      }

      // Workspace
      const workspace =
        (cfg.workspace as string) || cli?.workspace || defaultWorkspace;
      const agentDir =
        cli?.agentDir || join(OPENCLAW_HOME, "agents", id, "agent");

      // Subagents
      const subagentsCfg = cfg.subagents as
        | Record<string, unknown>
        | undefined;
      const subagents = (subagentsCfg?.allowAgents as string[]) || [];

      // Tools config
      const toolsCfg = cfg.tools as Record<string, unknown> | undefined;
      const toolsAllow = (toolsCfg?.allow as string[]) || [];
      const toolsBlock = (toolsCfg?.block as string[]) || [];
      const a2aCfg = toolsCfg?.agentToAgent as Record<string, unknown> | undefined;
      const a2aEnabled = !!a2aCfg?.enabled;
      const a2aAllow = (a2aCfg?.allow as string[]) || [];

      // Heartbeat
      const heartbeatCfg = cfg.heartbeat as { model?: string; interval?: number } | undefined;
      const heartbeat = heartbeatCfg || null;

      // Identity theme
      const identityCfg = cfg.identity as Record<string, unknown> | undefined;
      const identityTheme = (identityCfg?.theme as string) || null;

      // Bindings / channels
      const cliBindings = (cli?.bindingDetails || []).map((b) => b.trim());
      const persistedBindings = configBindingsByAgent.get(id) || [];
      const bindings = Array.from(
        new Set(
          [...persistedBindings, ...cliBindings].filter((b) => Boolean(b))
        )
      );
      const channels: string[] = [];
      for (const b of bindings) {
        const ch = b.split(" ")[0];
        if (ch && !channels.includes(ch)) channels.push(ch);
      }
      if (id === discoveredDefaultAgentId || cli?.isDefault) {
        for (const ch of connectedChannels) {
          if (!channels.includes(ch)) channels.push(ch);
        }
      }

      // Sessions & tokens from gateway truth.
      const sessionSummary = sessionsByAgent.get(id);
      const sessionCount = sessionSummary?.sessionCount || 0;
      const lastActive = sessionSummary && sessionSummary.lastActive > 0
        ? sessionSummary.lastActive
        : null;
      const totalTokens = sessionSummary?.totalTokens || 0;
      const runtimeSubagents = runtimeSubagentsByAgent.get(id) || [];

      // Identity snippet (first few meaningful lines)
      let identitySnippet: string | null = null;
      const idFile = await readTextSafe(join(workspace, "IDENTITY.md"));
      if (idFile) {
        const lines = idFile
          .split("\n")
          .filter((l) => l.trim() && !l.startsWith("#"))
          .slice(0, 6)
          .join("\n");
        identitySnippet = lines.slice(0, 500);
      }

      // Status
      const now = Date.now();
      const fiveMinAgo = now - 5 * 60 * 1000;
      const status: AgentFull["status"] = lastActive
        ? lastActive > fiveMinAgo
          ? "active"
          : "idle"
        : "unknown";

      agents.push({
        id,
        name,
        emoji,
        model,
        fallbackModels,
        workspace,
        agentDir,
        isDefault: Boolean(cli?.isDefault || id === discoveredDefaultAgentId),
        sessionCount,
        lastActive,
        totalTokens,
        bindings,
        channels,
        identitySnippet,
        subagents,
        runtimeSubagents,
        status,
        toolsAllow,
        toolsBlock,
        a2aEnabled,
        a2aAllow,
        heartbeat,
        identityTheme,
      });
    }

    // Sort: default first, then by name
    agents.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    // Get owner info from IDENTITY.md of the default workspace
    let ownerName: string | null = null;
    try {
      const defaultAgent = agents.find((a) => a.isDefault);
      if (defaultAgent?.identitySnippet) {
        // Try to parse owner from bindings or just use generic
      }
      // Also check the main identity file for owner hints
      const mainIdentity = await readTextSafe(
        join(defaultWorkspace, "IDENTITY.md")
      );
      if (mainIdentity) {
        const nameMatch = mainIdentity.match(
          /\*\*Name:\*\*\s*(.+?)(?:\n|$)/
        );
        if (nameMatch) ownerName = nameMatch[1].trim();
      }
    } catch {
      // ok
    }

    return NextResponse.json({
      agents,
      owner: ownerName,
      defaultModel: defaultPrimary,
      defaultFallbacks,
      configuredChannels,
    });
  } catch (err) {
    console.error("Agents API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/agents - Create a new agent or perform agent actions.
 *
 * Body:
 *   { action: "create", name: "work", model?: "provider/model", workspace?: "/path", bindings?: ["whatsapp:biz"] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case "create": {
        const name = (body.name as string)?.trim();
        if (!name) {
          return NextResponse.json(
            { error: "Agent name is required" },
            { status: 400 }
          );
        }

        // Validate name: alphanumeric + hyphens only
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
          return NextResponse.json(
            { error: "Agent name must start with a letter/number and contain only letters, numbers, hyphens, or underscores" },
            { status: 400 }
          );
        }

        // Build CLI args
        const args = ["agents", "add", name, "--non-interactive", "--json"];

        // Workspace (default or custom)
        const workspace =
          (body.workspace as string)?.trim() ||
          join(getOpenClawHome(), `workspace-${name}`);
        args.push("--workspace", workspace);

        // Model (optional — inherits default if not set)
        if (body.model) {
          args.push("--model", body.model as string);
        }

        // Bindings (optional, repeatable)
        const bindings = (body.bindings || []) as string[];
        for (const b of bindings) {
          if (b.trim()) args.push("--bind", b.trim());
        }

        const output = await runCli(args, 30000);

        // Try to parse JSON output
        let result: Record<string, unknown> = {};
        try {
          result = JSON.parse(output);
        } catch {
          result = { raw: output };
        }

        return NextResponse.json({ ok: true, action, name, workspace, ...result });
      }

      case "update": {
        const id = body.id as string;
        if (!id) {
          return NextResponse.json(
            { error: "Agent ID is required" },
            { status: 400 }
          );
        }

        const configPath = join(OPENCLAW_HOME, "openclaw.json");
        let config: Record<string, unknown>;
        try {
          config = JSON.parse(await readFile(configPath, "utf-8"));
        } catch {
          return NextResponse.json(
            { error: "Failed to read config" },
            { status: 500 }
          );
        }

        const agentsSection = config.agents as Record<string, unknown>;
        const agentsList = (agentsSection?.list || []) as Record<
          string,
          unknown
        >[];
        const agentIdx = agentsList.findIndex((a) => a.id === id);
        if (agentIdx === -1) {
          return NextResponse.json(
            { error: `Agent "${id}" not found in config` },
            { status: 404 }
          );
        }

        const agent = { ...agentsList[agentIdx] };

        // Update model
        if ("model" in body) {
          const newModel = body.model as string | null;
          const newFallbacks = (body.fallbacks || []) as string[];
          if (!newModel) {
            // Empty = inherit default, remove override
            delete agent.model;
          } else if (newFallbacks.length > 0) {
            agent.model = { primary: newModel, fallbacks: newFallbacks };
          } else {
            agent.model = newModel;
          }
        }

        // Update subagents
        if ("subagents" in body) {
          const subs = (body.subagents || []) as string[];
          if (subs.length > 0) {
            agent.subagents = {
              ...((agent.subagents as Record<string, unknown>) || {}),
              allowAgents: subs,
            };
          } else {
            delete agent.subagents;
          }
        }

        // Update bindings
        if ("bindings" in body) {
          const newBindings = (body.bindings || []) as string[];
          // Remove existing bindings for this agent
          const existingBindings = (
            (config.bindings || []) as Record<string, unknown>[]
          ).filter((b) => (b.agentId as string) !== id);
          // Add new ones
          for (const binding of newBindings) {
            const parts = binding.split(":");
            existingBindings.push({
              agentId: id,
              match: {
                channel: parts[0],
                accountId: parts[1] || "default",
              },
            });
          }
          config.bindings = existingBindings;
        }

        // Update tools.allow/block
        if ("toolsAllow" in body || "toolsBlock" in body) {
          const tools = (agent.tools as Record<string, unknown>) || {};
          if ((body.toolsAllow as string[])?.length) tools.allow = body.toolsAllow;
          else delete tools.allow;
          if ((body.toolsBlock as string[])?.length) tools.block = body.toolsBlock;
          else delete tools.block;
          if (Object.keys(tools).length > 0) agent.tools = tools;
          else delete agent.tools;
        }

        // Update A2A policy
        if ("a2aEnabled" in body) {
          const tools = (agent.tools as Record<string, unknown>) || {};
          if (body.a2aEnabled) {
            tools.agentToAgent = { enabled: true, allow: body.a2aAllow || [] };
          } else {
            delete tools.agentToAgent;
          }
          if (Object.keys(tools).length > 0) agent.tools = tools;
          else delete agent.tools;
        }

        // Update identity (emoji, theme)
        if ("identity" in body) {
          const id_ = body.identity as Record<string, unknown>;
          const existing = (agent.identity as Record<string, unknown>) || {};
          if (id_.emoji !== undefined) existing.emoji = id_.emoji || undefined;
          if (id_.theme !== undefined) existing.theme = id_.theme || undefined;
          if (existing.emoji || existing.theme) agent.identity = existing;
          else delete agent.identity;
        }

        // Update heartbeat
        if ("heartbeat" in body) {
          if (body.heartbeat) agent.heartbeat = body.heartbeat;
          else delete agent.heartbeat;
        }

        agentsList[agentIdx] = agent;
        agentsSection.list = agentsList;

        await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

        return NextResponse.json({ ok: true, action: "update", id });
      }

      case "delete": {
        const id = body.id as string;
        if (!id) {
          return NextResponse.json(
            { error: "Agent ID is required" },
            { status: 400 }
          );
        }

        // Try CLI delete first (handles registry cleanup, workspace removal)
        try {
          const output = await runCli(
            ["agents", "delete", id, "--non-interactive", "--json"],
            30000
          );
          let result: Record<string, unknown> = {};
          try { result = JSON.parse(output); } catch { result = { raw: output }; }

          // Also clean bindings from config
          const configPath = join(OPENCLAW_HOME, "openclaw.json");
          try {
            const config = JSON.parse(await readFile(configPath, "utf-8"));
            if (Array.isArray(config.bindings)) {
              config.bindings = (config.bindings as Record<string, unknown>[])
                .filter((b) => (b.agentId as string) !== id);
            }
            const agentsSection = config.agents as Record<string, unknown> | undefined;
            if (agentsSection) {
              const list = (agentsSection.list || []) as Record<string, unknown>[];
              agentsSection.list = list.filter((a) => a.id !== id);
            }
            await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
          } catch { /* config cleanup optional */ }

          return NextResponse.json({ ok: true, action: "delete", id, ...result });
        } catch (cliErr) {
          // If CLI fails (e.g. agent not in registry), try config-only cleanup
          const configPath = join(OPENCLAW_HOME, "openclaw.json");
          try {
            const config = JSON.parse(await readFile(configPath, "utf-8"));
            const agentsSection = config.agents as Record<string, unknown> | undefined;
            const list = ((agentsSection?.list || []) as Record<string, unknown>[]);
            const existed = list.some((a) => a.id === id);
            if (!existed) {
              return NextResponse.json(
                { error: `Agent "${id}" not found` },
                { status: 404 }
              );
            }
            if (agentsSection) {
              agentsSection.list = list.filter((a) => a.id !== id);
            }
            if (Array.isArray(config.bindings)) {
              config.bindings = (config.bindings as Record<string, unknown>[])
                .filter((b) => (b.agentId as string) !== id);
            }
            await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
            return NextResponse.json({ ok: true, action: "delete", id, cliError: String(cliErr) });
          } catch {
            return NextResponse.json(
              { error: `Failed to delete agent: ${cliErr}` },
              { status: 500 }
            );
          }
        }
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Agents API POST error:", err);
    const msg = String(err);
    // Make gateway errors user-friendly
    if (msg.includes("already exists") || msg.includes("Agent already")) {
      return NextResponse.json(
        { error: `An agent with this name already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
