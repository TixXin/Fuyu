import { AGENT_POPUP_LIST_SAVING, getAgentAlertExpandedHeight, POPUP_HEADER_SAVING } from "./layout.ts";
import type { IslandPage } from "./types";

const MESSAGE_ARRIVALS_CHROME_HEIGHT = 86;

type ExpandedHeightInput = {
  page: IslandPage;
  maxPanelHeight: number;
  agentAlertRowHeight?: number;
  messageArrivalsHeight?: number;
  popup?: boolean;
};

export function getExpandedIslandHeight({ page, maxPanelHeight, agentAlertRowHeight, messageArrivalsHeight, popup = false }: ExpandedHeightInput) {
  const height = page === "agents" && agentAlertRowHeight !== undefined
    ? getAgentAlertExpandedHeight(agentAlertRowHeight)
    : page === "qq" && messageArrivalsHeight !== undefined
      ? Math.min(MESSAGE_ARRIVALS_CHROME_HEIGHT + messageArrivalsHeight, maxPanelHeight)
      : maxPanelHeight;
  return popup ? height - POPUP_HEADER_SAVING - (page === "agents" ? AGENT_POPUP_LIST_SAVING : 0) : height;
}
