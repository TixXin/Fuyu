import type { IslandSettings, TuckHintColor } from "../../../../lib/settings/types";
import { isLightIsland } from "../../../../utils/color";

export const TUCK_HINT_WHITE = "#ffffff";

export function tuckHintPaint(color: TuckHintColor, settings: Pick<IslandSettings, "islandBackgroundColor" | "tuckHintCustomColor">) {
  if (color === "island") return settings.islandBackgroundColor;
  if (color === "custom") return settings.tuckHintCustomColor;
  return TUCK_HINT_WHITE;
}

export function tuckHintRing(color: TuckHintColor, paint: string): "dark" | "light" {
  if (color === "contrast") return "dark";
  if (color === "custom") return isLightIsland(paint) ? "dark" : "light";
  return "light";
}
