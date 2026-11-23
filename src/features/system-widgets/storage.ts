import { readJson, writeJson } from "../../lib/storage";
import { normalizeLauncher, serializeLauncher, type LauncherItem } from "./launcherItems.ts";

export const QUICK_LAUNCH_KEY = "fuyu-quick-launch";

export function readLauncher(): LauncherItem[] {
  return normalizeLauncher(readJson(QUICK_LAUNCH_KEY));
}

export function writeLauncher(items: readonly LauncherItem[]): void {
  writeJson(QUICK_LAUNCH_KEY, serializeLauncher(items));
}
