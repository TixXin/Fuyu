import type { AgentSession } from "../../features/agent-status/session";
import { LINE_PRIORITY, type IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import type { CollapsedLineSources } from "./slots/line";

const AGENT_ICON_TEXT = "MM";

type LegacyLineInput = {
  agentSession: AgentSession | null;
  interjecting: boolean;
  agentIconWidth: number;
};

export function useLegacyLines(input: LegacyLineInput): CollapsedLineSources {
  const t = useTranslation();
  const { agentSession } = input;
  const list: IslandContribution[] = [];
  if (agentSession) {
    list.push({
      kind: "line",
      item: "agent-status.session",
      priority: input.interjecting ? LINE_PRIORITY.agentInterjection : LINE_PRIORITY.agentTitle,
      measure: AGENT_ICON_TEXT + agentSession.title,
      extra: input.agentIconWidth,
      page: "agents",
      lead: true,
      handle: true,
      label: t.island.agentSession(agentSession.label, agentSession.title),
    });
  }
  useIslandContributions("builtin", "legacy.lines", list);
  return { agentSession };
}
