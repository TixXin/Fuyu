import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { AGENT_POPUP_LIST_SAVING, getAgentAlertExpandedHeight } from "./layout";

const MESSAGE_ARRIVALS_CHROME_HEIGHT = 86;

type LegacyPopupInput = {
  maxPanelHeight: number;
  agentCardHeight: number | undefined;
  agentAlert: boolean;
  arrivalsHeight: number | null;
};

export function messageArrivalsPanelHeight(listHeight: number, maxPanelHeight: number) {
  return Math.min(MESSAGE_ARRIVALS_CHROME_HEIGHT + listHeight, maxPanelHeight);
}

export function useLegacyPopups({ maxPanelHeight, agentCardHeight, agentAlert, arrivalsHeight }: LegacyPopupInput) {
  const list: IslandContribution[] = [{
    kind: "popup",
    page: "agents",
    height: agentCardHeight !== undefined ? getAgentAlertExpandedHeight(agentCardHeight) : undefined,
    saving: AGENT_POPUP_LIST_SAVING,
    open: agentAlert,
  }];
  if (arrivalsHeight !== null) list.push({ kind: "popup", page: "qq", height: messageArrivalsPanelHeight(arrivalsHeight, maxPanelHeight), open: true });
  useIslandContributions("builtin", "legacy.popups", list);
}
