import { readJson, writeJson } from "../../lib/storage.ts";

export const LEGACY_SWITCHES_KEY = "fuyu-legacy-switches";

export function loadMigratedSwitches(): Set<string> {
  const stored = readJson(LEGACY_SWITCHES_KEY);
  return new Set(Array.isArray(stored) ? stored.filter((field): field is string => typeof field === "string") : []);
}

export function saveMigratedSwitches(fields: Iterable<string>) {
  writeJson(LEGACY_SWITCHES_KEY, [...new Set(fields)].sort());
}
