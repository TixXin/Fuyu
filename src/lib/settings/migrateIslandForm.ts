import { isTauri } from "@tauri-apps/api/core";
import { isMacOS } from "../platform";
import { primaryScreenHasNotch } from "./api";
import { legacyIslandForm, needsIslandFormMigration } from "./islandFormMigration.ts";
import { readSettingsText } from "./storage";
import type { IslandForm } from "./types";

const NOTCH_QUERY_TIMEOUT_MS = 3_000;

export function storedSettingsText() {
  return isMacOS && isTauri() && needsIslandFormMigration(readSettingsText(), isMacOS) ? readSettingsText() : null;
}

export async function legacyFormFromScreen(stored: string): Promise<IslandForm | null> {
  const timeout = new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), NOTCH_QUERY_TIMEOUT_MS));
  const notch = await Promise.race([primaryScreenHasNotch(), timeout]).catch((error: unknown) => {
    console.error("Failed to read the notch for the island form", error);
    return false;
  });
  return legacyIslandForm(stored, { mac: isMacOS, notch });
}
