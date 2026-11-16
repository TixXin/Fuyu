import type { IslandSettings } from "../../lib/settings/types";

export const PILL_TOP_GAP = 10;

type FormSettings = Pick<IslandSettings, "islandForm" | "marginY" | "menuBarPlacement">;

export function islandMarginY({ islandForm, marginY }: Pick<IslandSettings, "islandForm" | "marginY">) {
  if (islandForm === "notch") return 0;
  if (islandForm === "pill") return Math.max(marginY, PILL_TOP_GAP);
  return marginY;
}

export function islandFormLayout(settings: FormSettings) {
  return {
    marginY: islandMarginY(settings),
    underMenuBar: settings.islandForm === "pill" || (settings.islandForm === "top" && settings.menuBarPlacement === "below"),
    fitNotch: settings.islandForm === "notch",
  };
}
