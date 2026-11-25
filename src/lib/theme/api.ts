import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const CUSTOM_FONTS_CHANGED = "custom-fonts-changed";

export type CustomFont = {
  id: string;
  name: string;
  file: string;
  format: string;
  size: number;
};

export type CustomFontImport = {
  name?: string;
  fileName: string;
  bytes: number[];
};

export function listCustomFonts() {
  return invoke<CustomFont[]>("list_custom_fonts");
}

export function importCustomFont(font: CustomFontImport) {
  return invoke<CustomFont>("import_custom_font", { font });
}

export function removeCustomFont(id: string) {
  return invoke<void>("remove_custom_font", { id });
}

export function readCustomFontFile(id: string) {
  return invoke<ArrayBuffer>("read_custom_font_file", { id });
}

export function openCustomFontsFolder() {
  return invoke<void>("open_custom_fonts_folder");
}

export function listenCustomFontsChanged(onChange: () => void) {
  return listen(CUSTOM_FONTS_CHANGED, onChange);
}
