import { readJson, writeJson } from "../../../lib/storage.ts";

export const HANDLED_KEY = "fuyu-message-handled";

export const HANDLED_LIMIT = 500;

export function normalizeHandled(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0 && entry.length <= 400 && !out.includes(entry)) out.push(entry);
  }
  return out.slice(-HANDLED_LIMIT);
}

export function loadHandled(): string[] {
  return normalizeHandled(readJson(HANDLED_KEY));
}

export function saveHandled(keys: readonly string[]) {
  writeJson(HANDLED_KEY, normalizeHandled(keys));
}

export function withHandled(keys: readonly string[], add: readonly string[], keep?: ReadonlySet<string>): string[] {
  const base = keep ? keys.filter((key) => keep.has(key)) : [...keys];
  for (const key of add) if (!base.includes(key)) base.push(key);
  return base.slice(-HANDLED_LIMIT);
}
