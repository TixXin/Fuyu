import type { MarketCatalogPlugin, MarketLocalizedText, MarketVersionCandidate } from "@fuyu/plugin-services";
import type { PluginCapabilityKind, PluginMarketSort } from "../../i18n/sections/settings/pluginMarket";
import { marketActionCandidate } from "./pluginRowStatus.ts";

export interface PluginCapabilities {
  network: readonly string[];
  nodeApis: readonly string[];
  replaces: readonly string[];
}

export interface CapabilityItem {
  kind: PluginCapabilityKind;
  detail: string[];
  sensitive: boolean;
}

export interface CategoryCount {
  id: string;
  count: number;
}

export const MAX_MARKET_SCREENSHOTS = 6;

const RUN_PROGRAMS = new Set(["child_process"]);
const FILES = new Set(["fs", "fs/promises"]);
const LOW_LEVEL = new Set(["worker_threads", "cluster", "vm"]);

export function localized(value: MarketLocalizedText | Record<string, string> | string | null | undefined, locale: string, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === "string") return value || fallback;
  const record = value as Record<string, string | undefined>;
  return (locale === "en" ? record.en : record["zh-CN"]) || record["zh-CN"] || record.en || fallback;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function capabilityItems(caps: PluginCapabilities): CapabilityItem[] {
  const modules = caps.nodeApis.map((api) => api.replace(/^node:/, ""));
  const pick = (set: ReadonlySet<string>) => modules.filter((name) => set.has(name));
  const plain = modules.filter((name) => !RUN_PROGRAMS.has(name) && !FILES.has(name) && !LOW_LEVEL.has(name));
  const items: CapabilityItem[] = [];
  const add = (kind: PluginCapabilityKind, detail: string[], sensitive: boolean) => {
    if (detail.length > 0) items.push({ kind, detail, sensitive });
  };
  add("replaces", [...caps.replaces], true);
  add("network", [...caps.network], false);
  add("runPrograms", pick(RUN_PROGRAMS), true);
  add("files", pick(FILES), true);
  add("nodeSensitive", pick(LOW_LEVEL), true);
  add("nodeApis", plain, false);
  return items;
}

export function offeredCandidate(plugin: MarketCatalogPlugin): MarketVersionCandidate | null {
  return marketActionCandidate(plugin)?.candidate ?? plugin.install ?? plugin.manual ?? plugin.autoUpdate ?? null;
}

export function hasUpdate(plugin: MarketCatalogPlugin): boolean {
  if (!plugin.installedVersion || plugin.blocked || plugin.revoked) return false;
  const action = marketActionCandidate(plugin);
  return Boolean(action?.isUpdate && action.candidate.version !== plugin.installedVersion);
}

export function isFirstFromPublisher(plugin: MarketCatalogPlugin, plugins: readonly MarketCatalogPlugin[]): boolean {
  if (plugin.official || plugin.installedVersion) return false;
  const publisher = plugin.publisher.github.toLowerCase();
  if (!publisher) return false;
  return !plugins.some((other) => other.name !== plugin.name && other.installedVersion && other.publisher.github.toLowerCase() === publisher);
}

const squash = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");

export function matchesQuery(plugin: MarketCatalogPlugin, query: string, categoryNames: Readonly<Record<string, string>> = {}): boolean {
  const q = squash(query.trim());
  if (!q) return true;
  const haystack = [
    plugin.name,
    plugin.publisher.github,
    plugin.displayName["zh-CN"],
    plugin.displayName.en,
    plugin.description["zh-CN"],
    plugin.description.en,
    ...plugin.categories.map((id) => categoryNames[id] ?? id),
  ];
  return squash(haystack.filter(Boolean).join(" ")).includes(q);
}

export function primaryCategory(plugin: MarketCatalogPlugin): string | null {
  return plugin.categories[0] ?? null;
}

export function inCategory(plugin: MarketCatalogPlugin, id: string): boolean {
  return primaryCategory(plugin) === id;
}

export function categoryCounts(plugins: readonly MarketCatalogPlugin[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const plugin of plugins) {
    const id = primaryCategory(plugin);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}

export function categoryNameMap(plugins: readonly MarketCatalogPlugin[], categoryName: (id: string) => string): Record<string, string> {
  return Object.fromEntries([...new Set(plugins.flatMap((plugin) => plugin.categories))].map((id) => [id, categoryName(id)]));
}

function rank(plugin: MarketCatalogPlugin): number {
  if (plugin.blocked || (plugin.revoked && !plugin.installedVersion)) return 4;
  if (plugin.installedVersion && !hasUpdate(plugin)) return 2;
  if (!marketActionCandidate(plugin) && !plugin.installedVersion) return 3;
  return plugin.official ? 0 : 1;
}

const DAY = 24 * 60 * 60 * 1000;
export const NEW_LISTING_DAYS = 14;
export const MARKET_SETTLE_DAYS = 30;

function timeOf(at: string | null | undefined): number | null {
  const time = at ? Date.parse(at) : NaN;
  return Number.isFinite(time) ? time : null;
}

function publishedAt(plugin: MarketCatalogPlugin): number {
  return timeOf(offeredCandidate(plugin)?.publishedAt) ?? 0;
}

function firstListedAt(plugin: MarketCatalogPlugin): number {
  return timeOf(plugin.firstPublishedAt) ?? publishedAt(plugin);
}

export function newListings(plugins: readonly MarketCatalogPlugin[], marketSince: string | null | undefined, now: number): ReadonlySet<string> {
  const since = timeOf(marketSince);
  if (since === null || now - since < MARKET_SETTLE_DAYS * DAY) return new Set();
  return new Set(plugins.flatMap((plugin) => {
    const first = timeOf(plugin.firstPublishedAt);
    return first !== null && first <= now && now - first < NEW_LISTING_DAYS * DAY ? [plugin.name] : [];
  }));
}

export function sortPlugins(plugins: readonly MarketCatalogPlugin[], sort: PluginMarketSort): MarketCatalogPlugin[] {
  const indexed = plugins.map((plugin, index) => ({ plugin, index }));
  indexed.sort((a, b) => {
    if (sort === "newest") return firstListedAt(b.plugin) - firstListedAt(a.plugin) || a.index - b.index;
    if (sort === "recent") return publishedAt(b.plugin) - publishedAt(a.plugin) || a.index - b.index;
    return rank(a.plugin) - rank(b.plugin) || a.index - b.index;
  });
  return indexed.map(({ plugin }) => plugin);
}

export interface BrowseSections {
  updates: MarketCatalogPlugin[];
  fresh: MarketCatalogPlugin[];
  owned: MarketCatalogPlugin[];
}

export function browseSections(plugins: readonly MarketCatalogPlugin[], sort: PluginMarketSort): BrowseSections {
  const rest = sortPlugins(plugins.filter((plugin) => !hasUpdate(plugin)), sort);
  return {
    updates: plugins.filter(hasUpdate),
    fresh: rest.filter((plugin) => !plugin.installedVersion),
    owned: rest.filter((plugin) => Boolean(plugin.installedVersion)),
  };
}

export function formatMarketTime(timestamp: number, locale: string, now = Date.now()): string {
  const at = new Date(timestamp);
  const sameDay = at.toDateString() === new Date(now).toDateString();
  const options: Intl.DateTimeFormatOptions = sameDay ? { hour: "2-digit", minute: "2-digit", hour12: false } : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  return at.toLocaleString(locale === "en" ? "en-GB" : "zh-CN", options);
}
