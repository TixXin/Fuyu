// Whether this is a new install, for settings whose first-launch default differs from what
// islands that already ran had.
import { readString } from "../../lib/storage.ts";

/**
 * The island's settings key (storage.ts); every island that ever ran has saved it. An island from
 * before the rename saved `focusd-island-settings`, which main.tsx copies here before anything loads.
 */
export const ISLAND_SETTINGS_KEY = "fuyu-settings";

/**
 * True when an island ran here before. Read it while the island's first render loads its
 * settings: the effects of that render save the settings, after which every install counts.
 */
export function islandRanBefore(): boolean {
  return readString(ISLAND_SETTINGS_KEY) !== null;
}
