import { POPUP_HEADER_SAVING } from "./layout.ts";

type ExpandedHeightInput = {
  maxPanelHeight: number;
  panel?: { height?: number; saving?: number };
  popup?: boolean;
};

export function getExpandedIslandHeight({ maxPanelHeight, panel, popup = false }: ExpandedHeightInput) {
  const height = panel?.height ?? maxPanelHeight;
  return popup ? height - POPUP_HEADER_SAVING - (panel?.saving ?? 0) : height;
}
