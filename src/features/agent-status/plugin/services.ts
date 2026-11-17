import { agentsV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { focusAgentWindow, getAgentRemoteHosts, getAgentUsage, getCodexUsage, type SessionProvider } from "../api";
import { focusParams, fromRust, usageReport } from "../host/index.mjs";
import { agentSources, registerAgentSource, subscribeAgentSources } from "../host/sources.mjs";
import { agentFeed, onAgentsChanged } from "./agentFeed";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  if (!isNativeError(error)) throw fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  throw fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

const noUsage = (error: unknown) => {
  console.error("Failed to read an agent usage for agents/v1", error);
  return null;
};

const PROVIDED_IN = new Set([null, "settings"]);

if (PROVIDED_IN.has(new URLSearchParams(window.location.search).get("window"))) {
  const provider = windowServices.provide(agentsV1, {
    sessions: async () => {
      const feed = agentFeed.get();
      if (!feed) throw Object.assign(new Error("agents/v1 sessions: the agent list is not loaded"), { code: "not-ready" });
      return agentSources.mergeSessions(feed);
    },
    usage: async () => {
      const [claude, codex] = await Promise.all([getAgentUsage().catch(noUsage), getCodexUsage().catch(noUsage)]);
      return agentSources.mergeUsage({ claude: usageReport(claude), codex: usageReport(codex) });
    },
    focus: async (params) => {
      const normalized = focusParams(params);
      const custom = await agentSources.tryFocus(normalized);
      if (custom) return custom;
      const found = await focusAgentWindow(normalized.provider as SessionProvider, normalized.cwd, normalized.title, normalized.sessionId).catch(failed);
      return { found };
    },
    remoteHosts: async () => {
      const hosts = await getAgentRemoteHosts().catch(failed);
      return { hosts: hosts.map((host) => ({ ...host, sessions: host.sessions ?? 0, approvalError: host.approvalError ?? null })) };
    },
  }, { owner: OWNER });
  onAgentsChanged((count) => provider.emit("changed", { count }));
  subscribeAgentSources(() => {
    const feed = agentFeed.get();
    provider.emit("changed", { count: (feed?.sessions.length ?? 0) + (feed?.others.length ?? 0) });
  });
}

export { agentSources, registerAgentSource, subscribeAgentSources };
