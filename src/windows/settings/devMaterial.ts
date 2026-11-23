import { Effect, EffectState, getCurrentWindow } from "@tauri-apps/api/window";

export const DEV_MATERIALS = ["sidebar", "hudWindow", "popover", "underWindowBackground", "liquidGlassRegular", "liquidGlassClear"] as const;

export type DevMaterial = (typeof DEV_MATERIALS)[number];

export const DEFAULT_DEV_MATERIAL: DevMaterial = "sidebar";

const EFFECTS: Record<DevMaterial, Effect> = {
  liquidGlassRegular: Effect.LiquidGlassRegular,
  liquidGlassClear: Effect.LiquidGlassClear,
  popover: Effect.Popover,
  hudWindow: Effect.HudWindow,
  sidebar: Effect.Sidebar,
  underWindowBackground: Effect.UnderWindowBackground,
};

export function applyDevMaterial(material: DevMaterial): Promise<void> {
  return getCurrentWindow().setEffects({ effects: [EFFECTS[material]], state: EffectState.Active });
}
