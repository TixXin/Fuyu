import type { IslandForm } from "./types";

export const ISLAND_FORMS = ["auto", "top", "pill", "notch"] as const satisfies readonly IslandForm[];

type StoredForm = { islandForm?: unknown; menuBarPlacement?: unknown } | null | undefined;

export function storedIslandForm(settings: StoredForm, mac: boolean): IslandForm {
  const form = (ISLAND_FORMS as readonly unknown[]).includes(settings?.islandForm) ? (settings?.islandForm as IslandForm) : null;
  if (form) return form;
  return mac && settings?.menuBarPlacement !== "below" ? "auto" : "top";
}
