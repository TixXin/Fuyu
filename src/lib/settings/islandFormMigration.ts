import type { IslandForm } from "./types";

export type FormEnvironment = { mac: boolean; notch: boolean };

function parsed(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function needsIslandFormMigration(text: string | null, mac: boolean) {
  const stored = parsed(text);
  return mac && stored !== null && stored.islandForm === undefined && stored.menuBarPlacement !== "below";
}

export function legacyIslandForm(text: string | null, { mac, notch }: FormEnvironment): IslandForm | null {
  if (!needsIslandFormMigration(text, mac)) return null;
  return notch ? "notch" : "top";
}
