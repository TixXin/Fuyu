import { LINE_PRIORITY, lineBelow, type IslandLineContribution } from "../../plugin-kernel/islandContributions.ts";
import type { AgentSession } from "../session.ts";

const ICON_TEXT = "MM";

export type AgentRanks = { agent: number | null; agentInterjection: number | null };

const DEFAULT_RANKS: AgentRanks = { agent: LINE_PRIORITY.agentTitle, agentInterjection: LINE_PRIORITY.agentInterjection };

export function pickAgentSession(lines: readonly IslandLineContribution[], titleMode: string, named: AgentSession | null, interjection: AgentSession | null, ranks: AgentRanks = DEFAULT_RANKS): AgentSession | null {
  if (ranks.agent === null || ranks.agentInterjection === null) return null;
  const below = lineBelow(lines, ranks.agentInterjection);
  const lyricsAhead = below?.shareable === true && below.priority > ranks.agent;
  return titleMode === "changes" || lyricsAhead ? interjection : named;
}

export function agentLineContribution(session: AgentSession | null, interjecting: boolean, iconWidth: number, label: string, ranks: AgentRanks = DEFAULT_RANKS, sticky = false): IslandLineContribution | null {
  const priority = interjecting ? ranks.agentInterjection : ranks.agent;
  if (!session || priority === null) return null;
  return {
    kind: "line",
    item: "agent-status.session",
    priority,
    measure: ICON_TEXT + session.title,
    extra: iconWidth,
    page: "agents",
    lead: true,
    handle: true,
    label,
    ...(interjecting && { interjection: true }),
    ...(sticky && { sticky: true }),
  };
}
