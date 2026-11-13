import { readJson, writeJson } from "../../lib/storage.ts";
import { normalizeFirstHints, type FirstHintsState } from "./hints.ts";

export const FIRST_HINTS_STORAGE_KEY = "fuyu-first-hints";

export function loadFirstHints(): FirstHintsState {
  return normalizeFirstHints(readJson(FIRST_HINTS_STORAGE_KEY));
}

export function saveFirstHints(state: FirstHintsState) {
  writeJson(FIRST_HINTS_STORAGE_KEY, state);
}
