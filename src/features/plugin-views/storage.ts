import { readJson, writeJson } from "../../lib/storage.ts";
import { normalizePluginPagePrefs, type PluginPagePrefs } from "./pagePrefs.ts";

export const PLUGIN_PAGES_STORAGE_KEY = "fuyu-plugin-pages";

export function loadPluginPagePrefs(): PluginPagePrefs {
  return normalizePluginPagePrefs(readJson(PLUGIN_PAGES_STORAGE_KEY));
}

export function savePluginPagePrefs(prefs: PluginPagePrefs) {
  return writeJson(PLUGIN_PAGES_STORAGE_KEY, prefs);
}

export function subscribePluginPagePrefs(onChange: (prefs: PluginPagePrefs) => void) {
  const listener = (event: StorageEvent) => {
    if (event.key === PLUGIN_PAGES_STORAGE_KEY) onChange(loadPluginPagePrefs());
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
