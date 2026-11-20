import { useState } from "react";
import { EXPANDED_ISLAND_WIDTH, POPUP_ISLAND_WIDTH } from "./layout";
import type { IslandMode } from "./types";

export function useIslandPopup(mode: IslandMode, showsCard: boolean, pageWidth: number | null = null, panelWidth = EXPANDED_ISLAND_WIDTH, wide = false) {
  const [kept, setKept] = useState(showsCard);
  if (mode === "expanded" && kept !== showsCard) setKept(showsCard);
  const popup = mode === "expanded" ? showsCard : kept;
  return { popup, expandedIslandWidth: popup ? (wide ? panelWidth : POPUP_ISLAND_WIDTH) : pageWidth ?? panelWidth };
}
