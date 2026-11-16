import type { IslandForm, IslandSettings } from "../../lib/settings/types";

export const PILL_TOP_GAP = 10;

export type ShownIslandForm = Exclude<IslandForm, "auto">;

type FormSettings = Pick<IslandSettings, "islandForm" | "marginY" | "menuBarPlacement">;

export function shownIslandForm(form: IslandForm, auto: ShownIslandForm | null): ShownIslandForm {
  return form === "auto" ? auto ?? "top" : form;
}

export function islandMarginY({ islandForm, marginY }: Pick<IslandSettings, "islandForm" | "marginY">, auto: ShownIslandForm | null = null) {
  const form = shownIslandForm(islandForm, auto);
  if (form === "notch") return 0;
  if (form === "pill") return Math.max(marginY, PILL_TOP_GAP);
  return marginY;
}

export function islandFormLayout(settings: FormSettings) {
  const form = shownIslandForm(settings.islandForm, null);
  return {
    marginY: islandMarginY({ islandForm: form, marginY: settings.marginY }),
    underMenuBar: form === "pill" || (form === "top" && settings.menuBarPlacement === "below"),
    fitNotch: form === "notch",
    autoForm: settings.islandForm === "auto",
  };
}
