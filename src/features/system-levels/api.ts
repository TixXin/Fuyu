import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type LevelChange =
  | { kind: "volume"; level: number; muted: boolean }
  | { kind: "brightness"; level: number };

export function listenLevelChanges(onChange: (change: LevelChange) => void) {
  return listen<LevelChange>("system-level-changed", (event) => onChange(event.payload));
}

export type SystemLevels = { volume: number | null; muted: boolean; brightness: number | null };

export function getSystemLevels() {
  return invoke<SystemLevels>("get_system_levels");
}

export function setSystemVolume(level: number) {
  return invoke<void>("set_system_volume", { level });
}
