import type { AgentSessionView } from "./agentSettings";

export const AGENT_POPUP_LIST_SAVING = 4;

const AGENT_PAGE_CHROME_HEIGHT = 78;
const AGENT_ROWS: Record<AgentSessionView, { height: number; gap: number }> = {
  list: { height: 78, gap: 2 },
  cards: { height: 62, gap: 6 },
  compact: { height: 34, gap: 4 },
};
const AGENT_USAGE_HEIGHT = 28;

export function getAgentPageExpandedHeight(rows: number, usageLines: number | boolean = 0, view: AgentSessionView = "list") {
  const { height, gap } = AGENT_ROWS[view];
  return AGENT_PAGE_CHROME_HEIGHT + Number(usageLines) * AGENT_USAGE_HEIGHT + rows * (height + gap) - gap;
}

export function getAgentAlertExpandedHeight(rowHeight: number) {
  return AGENT_PAGE_CHROME_HEIGHT + rowHeight;
}
