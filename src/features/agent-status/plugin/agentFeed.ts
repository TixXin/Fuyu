import type { AgentSessions } from "@fuyu/plugin-services";
import { createRunnerStore } from "../../plugin-kernel/runnerStore.ts";
import type { AgentSessionSummary, ExternalAgentStatus } from "../api";
import { reportEntry, sessionEntry } from "../host/index.mjs";
import { sessionKey } from "../unseen.ts";

type Announce = (count: number) => void;

export const agentFeed = createRunnerStore<AgentSessions | null>(null);

let announce: Announce | null = null;

export function onAgentsChanged(listener: Announce) {
  announce = listener;
}

export function announceAgentsChanged(count: number) {
  announce?.(count);
}

export function agentFeedOf(
  sessions: readonly AgentSessionSummary[],
  listed: readonly AgentSessionSummary[],
  unseen: ReadonlySet<string>,
  others: readonly ExternalAgentStatus[] | undefined,
): AgentSessions {
  const shown = new Set(listed.map(sessionKey));
  return {
    sessions: sessions.map((session) => {
      const key = sessionKey(session);
      return sessionEntry(session, { listed: shown.has(key), unseen: unseen.has(key) });
    }),
    others: (others ?? []).map(reportEntry),
  };
}
