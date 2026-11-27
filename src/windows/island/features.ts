import {
  effectivePageDockZone,
  orderIslandPages,
  type EnabledDockSides,
  type IslandPagesLayout,
} from "../../lib/settings/islandPages.ts";
import type { PlatformFeature } from "../../lib/platform.ts";
import { pageSlot } from "./slots/pageSlot.ts";
import type { BuiltinPage, HeaderDotPage, IslandPage } from "./types";

export type { HeaderDotPage };

type MessageSwitch = "qq" | "wechat" | "qqMail";

export type IslandFeatures = Record<BuiltinPage | MessageSwitch, boolean> & {
  clipboardScreenshots?: boolean;
  pageLayout?: IslandPagesLayout;
  enabledSides?: EnabledDockSides;
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

const NO_SIDES: EnabledDockSides = { left: false, right: false };

const isTopDocked = (id: string, features: IslandFeatures) =>
  effectivePageDockZone(features.pageLayout, id, features.enabledSides ?? NO_SIDES) === "top";

export function withPageLayout(
  features: IslandFeatures,
  pageLayout: IslandPagesLayout,
  enabledSides?: EnabledDockSides,
): IslandFeatures {
  const hasLayout =
    pageLayout.order.length > 0 ||
    pageLayout.hidden.length > 0 ||
    Object.keys(pageLayout.icons ?? {}).length > 0 ||
    Object.keys(pageLayout.names ?? {}).length > 0 ||
    Object.keys(pageLayout.placement ?? {}).length > 0;
  const hasSides = enabledSides !== undefined && (enabledSides.left || enabledSides.right);
  if (!hasLayout && !hasSides) return features;
  return {
    ...features,
    ...(hasLayout ? { pageLayout } : {}),
    ...(hasSides ? { enabledSides } : {}),
  };
}

type Orderable = { shortcutOrder?: number; headerDot?: boolean; external?: boolean };

const LAST = Number.MAX_SAFE_INTEGER;

export const isHeaderDot = (item: Orderable) => (item.external === true ? item.headerDot !== false : item.headerDot === true);

export function byShortcut<Item extends Orderable>(items: readonly Item[]): Item[] {
  const dotsEnd = Math.max(0, ...items.filter((item) => item.external !== true && item.headerDot === true).map((item) => item.shortcutOrder ?? 0));
  const rank = (item: Item): [number, number, number] =>
    item.external === true ? [dotsEnd, 1, item.shortcutOrder ?? LAST] : [item.shortcutOrder ?? LAST, 0, 0];
  return [...items].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
}

type PageSwitch = { enabled?: (features: IslandFeatures) => boolean };

const itemEnabled = (item: PageSwitch, features: IslandFeatures) => {
  if (item.enabled === undefined) return true;
  try {
    return item.enabled(features) === true;
  } catch {
    return false;
  }
};

export function headerDotPages<Item extends PageSwitch & Orderable & { id: string }>(items: readonly Item[], features: IslandFeatures): Item[] {
  return orderIslandPages(
    byShortcut(items.filter((item) => isHeaderDot(item) && itemEnabled(item, features) && isTopDocked(item.id, features))),
    features.pageLayout,
  );
}

const pageItem = (page: IslandPage) => pageSlot.items().find((item) => item.id === page);

export function isPageEnabled(page: IslandPage, features: IslandFeatures): boolean {
  const item = pageItem(page);
  return item !== undefined && itemEnabled(item, features);
}

export function isPageShown(page: IslandPage, features: IslandFeatures): boolean {
  return isPageEnabled(page, features) && isTopDocked(page, features) && !(features.pageLayout?.hidden.includes(page) ?? false);
}

export function resolveIslandPage(page: IslandPage, features: IslandFeatures): IslandPage | null {
  if (isPageEnabled(page, features) && isTopDocked(page, features)) return page;
  const fallback = pageItem(page)?.fallback?.(features);
  if (fallback && isTopDocked(fallback, features)) return fallback;
  const topCandidate = pageSlot.items().map((item) => item.id as IslandPage).find((candidate) => isPageEnabled(candidate, features) && isTopDocked(candidate, features));
  if (topCandidate) return topCandidate;
  if (isPageEnabled(page, features)) return page;
  return pageSlot.items().map((item) => item.id as IslandPage).find((candidate) => isPageEnabled(candidate, features)) ?? null;
}

export function pageShortcutOrder(features: IslandFeatures): IslandPage[] {
  return orderIslandPages(byShortcut(pageSlot.items()), features.pageLayout)
    .map((item) => item.id as IslandPage)
    .filter((page) => isPageEnabled(page, features) && isTopDocked(page, features));
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
