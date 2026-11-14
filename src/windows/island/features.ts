import type { MessageSource } from "../../features/messages/messagePreview";
import type { PlatformFeature } from "../../lib/platform.ts";
import type { BuiltinPage, IslandPage, PluginPageId } from "./types";

export type IslandFeatures = {
  todo: boolean;
  calendar?: boolean;
  music: boolean;
  clipboard: boolean;
  shelf: boolean;
  screenshots?: boolean;
  timer?: boolean;
  qq: boolean;
  wechat: boolean;
  qqMail: boolean;
  agents: boolean;
  translation: boolean;
  pluginPages?: readonly PluginPageId[];
};

export function withoutUnsupported(features: IslandFeatures, unsupported: ReadonlySet<PlatformFeature>): IslandFeatures {
  if (unsupported.size === 0) return features;
  return {
    ...features,
    music: features.music && !unsupported.has("music"),
    clipboard: features.clipboard && !unsupported.has("clipboard"),
    screenshots: (features.screenshots ?? false) && !unsupported.has("screenshot"),
    qq: features.qq && !unsupported.has("qq"),
    wechat: features.wechat && !unsupported.has("wechat"),
    translation: features.translation && !unsupported.has("translation"),
  };
}

export function isPluginPage(page: IslandPage): page is PluginPageId {
  return page.startsWith("plugin:");
}

const BUILTIN_PAGE_ORDER: BuiltinPage[] = ["todo", "calendar", "music", "clipboard", "shelf", "screenshots", "timer", "qq", "agents", "translation"];
const SOURCE_ORDER: MessageSource[] = ["qq", "wechat", "qqMail"];
export const HEADER_DOT_PAGES = ["todo", "music", "calendar", "clipboard", "shelf", "screenshots", "timer"] as const satisfies readonly BuiltinPage[];
export type HeaderDotPage = (typeof HEADER_DOT_PAGES)[number];

function pageOrder(features: IslandFeatures): IslandPage[] {
  return [...BUILTIN_PAGE_ORDER, ...(features.pluginPages ?? [])];
}

function shortcutOrder(features: IslandFeatures): IslandPage[] {
  return ["agents", ...HEADER_DOT_PAGES, ...(features.pluginPages ?? []), "qq", "translation"];
}

export function isPageEnabled(page: IslandPage, features: IslandFeatures): boolean {
  if (isPluginPage(page)) return features.pluginPages?.includes(page) ?? false;
  return page === "qq" ? features.qq || features.wechat || features.qqMail : features[page] === true;
}

export function resolveIslandPage(page: IslandPage, features: IslandFeatures): IslandPage | null {
  if (isPageEnabled(page, features)) return page;
  return pageOrder(features).find((candidate) => isPageEnabled(candidate, features)) ?? null;
}

export function resolveMessageSource(source: MessageSource, features: IslandFeatures): MessageSource {
  if (features[source]) return source;
  return SOURCE_ORDER.find((candidate) => features[candidate]) ?? source;
}

export function pageShortcutOrder(features: IslandFeatures): IslandPage[] {
  return shortcutOrder(features).filter((page) => isPageEnabled(page, features));
}

export function pageForAltDigit(features: IslandFeatures, digit: number): IslandPage | null {
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return null;
  return pageShortcutOrder(features)[digit - 1] ?? null;
}

export function pageShortcutLabel(features: IslandFeatures, page: IslandPage, modifiers: string): string | null {
  const index = pageShortcutOrder(features).indexOf(page);
  return index < 0 || index > 8 ? null : `${modifiers}+${index + 1}`;
}

export function cycleShortcutPage(features: IslandFeatures, page: IslandPage, direction: 1 | -1): IslandPage | null {
  const order = pageShortcutOrder(features);
  if (order.length < 2) return null;
  const index = order.indexOf(page);
  const start = index < 0 ? (direction > 0 ? -1 : 0) : index;
  const target = order[(start + direction + order.length) % order.length];
  return target === page ? null : target;
}
