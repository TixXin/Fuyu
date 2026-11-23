import type { CSSProperties, ReactNode } from "react";
import { hexToRgba } from "../../lib/settings/settings";
import type { IslandSettings } from "../../lib/settings/types";
import { islandInkRgb, surfaceThemeColors } from "../../lib/theme/themeMode";
import { isLightIsland } from "../../utils/color";
import "./AgentStageIsland.css";

const INK = { "--text-1": 0.95, "--text-2": 0.7, "--text-3": 0.55 };

export function AgentStageIsland({ settings, label, children }: { settings: IslandSettings; label?: string; children: ReactNode }) {
  const look = surfaceThemeColors(settings, "panel");
  const light = isLightIsland(look.islandBackgroundColor);
  const ink = islandInkRgb(look);
  const style = {
    background: hexToRgba(look.islandBackgroundColor, Math.max(0.92, settings.opacity / 100)),
    "--overlay-rgb": ink,
    ...Object.fromEntries(Object.entries(INK).map(([name, alpha]) => [name, `rgba(${ink}, ${alpha})`])),
  } as CSSProperties;
  return (
    <div className={`agent-stage-island${light ? " island-light" : " agent-stage-island--dark"}`} style={style} role="group" aria-label={label}>
      {children}
    </div>
  );
}
