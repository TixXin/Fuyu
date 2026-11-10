import { invoke } from "@tauri-apps/api/core";

/** The theme market's raw entries (themes.json in TixXin/focusd-plugins); model.ts checks them. */
export function getThemeMarket() {
  return invoke<unknown[]>("get_theme_market");
}
