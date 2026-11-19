import type { CSSProperties } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { isLightIsland } from "../../utils/color";
import type { IslandSide } from "./useIslandSide";
import "./IslandTuckHint.css";

export type TuckHintSettings = Pick<IslandSettings, "tuckHintStyle" | "tuckHintColor" | "tuckHintCustomColor" | "tuckHintBreathe">;

export function IslandTuckHint({ hint, side }: { hint: TuckHintSettings; side: IslandSide | null }) {
  const custom = hint.tuckHintColor === "custom";
  const className = [
    "island-tuck-hint",
    `island-tuck-hint--${hint.tuckHintStyle}`,
    `island-tuck-hint--${hint.tuckHintColor}`,
    side ? `island-tuck-hint--side-${side}` : "",
    custom && isLightIsland(hint.tuckHintCustomColor) ? "island-tuck-hint--light-core" : "",
    hint.tuckHintBreathe ? "island-tuck-hint--breathe" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = custom ? ({ "--tuck-hint-custom": hint.tuckHintCustomColor } as CSSProperties) : undefined;
  return <span className={className} style={style} aria-hidden="true" />;
}
