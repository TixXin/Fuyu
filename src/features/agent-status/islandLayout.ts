import type { AgentSessionView } from "./agentSettings";

export const AGENT_POPUP_LIST_SAVING = 4;

const AGENT_PAGE_CHROME_HEIGHT = 78;
const AGENT_ROWS: Record<AgentSessionView, { height: number; gap: number }> = {
  focused: { height: 74, gap: 6 },
  split: { height: 68, gap: 6 },
  bento: { height: 72, gap: 8 },
  projects: { height: 68, gap: 6 },
  minimal: { height: 42, gap: 4 },
};
const AGENT_USAGE_HEIGHT = 28;

export function getAgentPageExpandedHeight(rows: number, usageLines: number | boolean = 0, view: AgentSessionView = "focused") {
  const { height, gap } = AGENT_ROWS[view] ?? AGENT_ROWS.focused;
  return AGENT_PAGE_CHROME_HEIGHT + Number(usageLines) * AGENT_USAGE_HEIGHT + rows * (height + gap) - gap;
}

export function getAgentAlertExpandedHeight(rowHeight: number) {
  return AGENT_PAGE_CHROME_HEIGHT + rowHeight;
}
