import type { Translations } from "../../i18n/types";
import type { PopupFilter } from "./popupFilters";

export function popupFilterLabel(chip: PopupFilter, text: Translations["clipboard"]): string {
  if (chip.startsWith("#")) return chip;
  if (chip === "all") return text.all;
  if (chip === "favorites") return text.favorites;
  if (chip === "images") return text.images;
  if (chip === "files") return text.files;
  if (chip === "links") return text.popup.actions.kinds.link;
  if (chip === "colors") return text.popup.actions.kinds.color;
  return text.popup.tabs.snippets;
}
