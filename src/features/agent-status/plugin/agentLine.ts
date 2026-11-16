import { LINE_PRIORITY, lineBelow, type IslandLineContribution } from "../../plugin-kernel/islandContributions.ts";
import type { AgentSession } from "../session.ts";

const ICON_TEXT = "MM";

export function pickAgentSession(lines: readonly IslandLineContribution[], titleMode: string, named: AgentSession | null, interjection: AgentSession | null): AgentSession | null {
  const below = lineBelow(lines, LINE_PRIORITY.agentInterjection);
  const lyricsAhead = below?.shareable === true && below.priority > LINE_PRIORITY.agentTitle;
  return titleMode === "changes" || lyricsAhead ? interjection : named;
}

export function agentLineContribution(session: AgentSession | null, interjecting: boolean, iconWidth: number, label: string): IslandLineContribution | null {
  if (!session) return null;
  return {
    kind: "line",
    item: "agent-status.session",
    priority: interjecting ? LINE_PRIORITY.agentInterjection : LINE_PRIORITY.agentTitle,
    measure: ICON_TEXT + session.title,
    extra: iconWidth,
    page: "agents",
    lead: true,
    handle: true,
    label,
  };
}
