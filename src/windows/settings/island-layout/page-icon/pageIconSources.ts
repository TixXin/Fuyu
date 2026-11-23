import { parsePageIcon } from "../../../../lib/settings/pageIconValue";

export type PageIconSource = "icon" | "emoji" | "text" | "image";

export const PAGE_ICON_SOURCES: readonly PageIconSource[] = ["icon", "emoji", "text", "image"];

export function sourceOf(value: string): PageIconSource {
  const parsed = parsePageIcon(value);
  return parsed?.kind === "emoji" || parsed?.kind === "text" || parsed?.kind === "image" ? parsed.kind : "icon";
}
