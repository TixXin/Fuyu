import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type LevelChange =
  | { kind: "volume"; level: number; muted: boolean }
  | { kind: "brightness"; level: number };

export function setLevelPopupEnabled(enabled: boolean) {
  return invoke<void>("set_level_popup_enabled", { enabled });
}

export function listenLevelChanges(onChange: (change: LevelChange) => void) {
  return listen<LevelChange>("system-level-changed", (event) => onChange(event.payload));
}
