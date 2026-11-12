import { readString } from "../../lib/storage.ts";

export const ISLAND_SETTINGS_KEY = "fuyu-settings";

export function islandRanBefore(): boolean {
  return readString(ISLAND_SETTINGS_KEY) !== null;
}
