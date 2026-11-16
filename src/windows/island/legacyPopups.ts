import type { IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";

const MESSAGE_ARRIVALS_CHROME_HEIGHT = 86;

type LegacyPopupInput = {
  maxPanelHeight: number;
  arrivalsHeight: number | null;
};

export function messageArrivalsPanelHeight(listHeight: number, maxPanelHeight: number) {
  return Math.min(MESSAGE_ARRIVALS_CHROME_HEIGHT + listHeight, maxPanelHeight);
}

export function useLegacyPopups({ maxPanelHeight, arrivalsHeight }: LegacyPopupInput) {
  const list: IslandContribution[] = [];
  if (arrivalsHeight !== null) list.push({ kind: "popup", page: "qq", height: messageArrivalsPanelHeight(arrivalsHeight, maxPanelHeight), open: true });
  useIslandContributions("builtin", "legacy.popups", list);
}
