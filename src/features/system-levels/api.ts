import { listen } from "@tauri-apps/api/event";

export type LevelChange =
  | { kind: "volume"; level: number; muted: boolean }
  | { kind: "brightness"; level: number };

export function listenLevelChanges(onChange: (change: LevelChange) => void) {
  return listen<LevelChange>("system-level-changed", (event) => onChange(event.payload));
}
