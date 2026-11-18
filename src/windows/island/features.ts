import type { PlatformFeature } from "../../lib/platform.ts";
import { pageSlot } from "./slots/pageSlot.ts";
import type { BuiltinPage, HeaderDotPage, IslandPage } from "./types";

export type { HeaderDotPage };

type MessageSwitch = "qq" | "wechat" | "qqMail";

export type IslandFeatures = Record<BuiltinPage | MessageSwitch, boolean> & {
  clipboardScreenshots?: boolean;
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

const byShortcut = <Item extends { shortcutOrder?: number }>(items: readonly Item[]) =>
  [...items].sort((a, b) => (a.shortcutOrder ?? Number.MAX_SAFE_INTEGER) - (b.shortcutOrder ?? Number.MAX_SAFE_INTEGER));

type PageSwitch = { enabled?: (features: IslandFeatures) => boolean };

const itemEnabled = (item: PageSwitch, features: IslandFeatures) => item.enabled === undefined || item.enabled(features) === true;

export function headerDotPages<Item extends PageSwitch & { headerDot?: boolean; shortcutOrder?: number }>(items: readonly Item[], features: IslandFeatures): Item[] {
  return byShortcut(items.filter((item) => item.headerDot === true && itemEnabled(item, features)));
}

const pageItem = (page: IslandPage) => pageSlot.items().find((item) => item.id === page);

export function isPageEnabled(page: IslandPage, features: IslandFeatures): boolean {
  const item = pageItem(page);
  return item !== undefined && itemEnabled(item, features);
}

export function resolveIslandPage(page: IslandPage, features: IslandFeatures): IslandPage | null {
  if (isPageEnabled(page, features)) return page;
  const fallback = pageItem(page)?.fallback?.(features);
  if (fallback) return fallback;
  return pageSlot.items().map((item) => item.id as IslandPage).find((candidate) => isPageEnabled(candidate, features)) ?? null;
}

export function pageShortcutOrder(features: IslandFeatures): IslandPage[] {
  return byShortcut(pageSlot.items()).map((item) => item.id as IslandPage).filter((page) => isPageEnabled(page, features));
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
