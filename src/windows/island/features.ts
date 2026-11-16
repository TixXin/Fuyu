import type { MessageSource } from "../../features/messages/messagePreview";
import type { PlatformFeature } from "../../lib/platform.ts";
import { pageSlot } from "./slots/pageSlot.ts";
import type { BuiltinPage, HeaderDotPage, IslandPage, PluginPageId } from "./types";

export type { HeaderDotPage };

export type IslandFeatures = Record<BuiltinPage | MessageSource, boolean> & {
  clipboardScreenshots?: boolean;
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

export function foldScreenshotsIntoClipboard(features: IslandFeatures): IslandFeatures {
  if (!features.clipboard || !features.screenshots) return { ...features, clipboardScreenshots: false };
  return { ...features, screenshots: false, clipboardScreenshots: true };
}

export function isPluginPage(page: IslandPage): page is PluginPageId {
  return page.startsWith("plugin:");
}

const SOURCE_ORDER: MessageSource[] = ["qq", "wechat", "qqMail"];

const byShortcut = <Item extends { shortcutOrder?: number }>(items: readonly Item[]) =>
  [...items].sort((a, b) => (a.shortcutOrder ?? Number.MAX_SAFE_INTEGER) - (b.shortcutOrder ?? Number.MAX_SAFE_INTEGER));

type PageSwitch = { enabled?: (features: IslandFeatures) => boolean };

const itemEnabled = (item: PageSwitch, features: IslandFeatures) => item.enabled === undefined || item.enabled(features) === true;

export function headerDotPages<Item extends PageSwitch & { headerDot?: boolean; shortcutOrder?: number }>(items: readonly Item[], features: IslandFeatures): Item[] {
  return byShortcut(items.filter((item) => item.headerDot === true && itemEnabled(item, features)));
}

const pageItem = (page: IslandPage) => pageSlot.items().find((item) => item.id === page);

function pageOrder(features: IslandFeatures): IslandPage[] {
  return [...pageSlot.items().map((item) => item.id as IslandPage), ...(features.pluginPages ?? [])];
}

function shortcutOrder(features: IslandFeatures): IslandPage[] {
  const items = byShortcut(pageSlot.items());
  const afterDots = items.reduce((end, item, index) => (item.headerDot ? index + 1 : end), 0);
  const pages = items.map((item) => item.id as IslandPage);
  return [...pages.slice(0, afterDots), ...(features.pluginPages ?? []), ...pages.slice(afterDots)];
}

export function isPageEnabled(page: IslandPage, features: IslandFeatures): boolean {
  if (isPluginPage(page)) return features.pluginPages?.includes(page) ?? false;
  const item = pageItem(page);
  return item !== undefined && itemEnabled(item, features);
}

export function resolveIslandPage(page: IslandPage, features: IslandFeatures): IslandPage | null {
  if (isPageEnabled(page, features)) return page;
  const fallback = pageItem(page)?.fallback?.(features);
  if (fallback) return fallback;
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
