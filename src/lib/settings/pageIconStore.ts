import { readJson, removeItem, writeJson } from "../storage.ts";
import { parsePageIcon } from "./pageIconValue.ts";

export const PAGE_ICON_IMAGES_KEY = "fuyu-page-icons";
export const PAGE_ICON_RECENT_KEY = "fuyu-page-icon-recent";

export type PageIconImage = { id: string; data: string; mono: boolean };

export const PAGE_ICON_IMAGES_MAX = 24;
export const PAGE_ICON_RECENT_MAX = 8;
const IMAGE_DATA_MAX = 60_000;
const IMAGE_ID = /^[a-z0-9]{6,24}$/;
const PNG_DATA = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;
const VERSION = 1;

export function readPageIconImages(value: unknown): PageIconImage[] {
  if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== VERSION) return [];
  const images = (value as { images?: unknown }).images;
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: PageIconImage[] = [];
  for (const item of images) {
    if (typeof item !== "object" || item === null) continue;
    const { id, data, mono } = item as Record<string, unknown>;
    if (typeof id !== "string" || !IMAGE_ID.test(id) || seen.has(id)) continue;
    if (typeof data !== "string" || data.length > IMAGE_DATA_MAX || !PNG_DATA.test(data)) continue;
    seen.add(id);
    result.push({ id, data, mono: mono === true });
    if (result.length >= PAGE_ICON_IMAGES_MAX) break;
  }
  return result;
}

export function loadPageIconImages(): PageIconImage[] {
  return readPageIconImages(readJson(PAGE_ICON_IMAGES_KEY));
}

export function savePageIconImages(images: readonly PageIconImage[]): boolean {
  if (images.length === 0) return removeItem(PAGE_ICON_IMAGES_KEY);
  return writeJson(PAGE_ICON_IMAGES_KEY, { version: VERSION, images: images.slice(-PAGE_ICON_IMAGES_MAX) });
}

export function isPageIconImageData(data: string): boolean {
  return data.length <= IMAGE_DATA_MAX && PNG_DATA.test(data);
}

export function newPageIconImageId(random: () => number = Math.random): string {
  let id = "";
  while (id.length < 12) id += Math.floor(random() * 36).toString(36);
  return id;
}

export function readPageIconRecent(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is string => typeof item === "string" && parsePageIcon(item) !== null && !seen.has(item) && Boolean(seen.add(item)))
    .slice(0, PAGE_ICON_RECENT_MAX);
}

export function loadPageIconRecent(): string[] {
  return readPageIconRecent(readJson(PAGE_ICON_RECENT_KEY));
}

export function pushPageIconRecent(recent: readonly string[], icon: string): string[] {
  return [icon, ...recent.filter((item) => item !== icon)].slice(0, PAGE_ICON_RECENT_MAX);
}

export function savePageIconRecent(recent: readonly string[]) {
  if (recent.length === 0) removeItem(PAGE_ICON_RECENT_KEY);
  else writeJson(PAGE_ICON_RECENT_KEY, recent);
}
