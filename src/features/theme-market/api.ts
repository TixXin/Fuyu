import { invoke } from "@tauri-apps/api/core";

export function getThemeMarket() {
  return invoke<unknown[]>("get_theme_market");
}
