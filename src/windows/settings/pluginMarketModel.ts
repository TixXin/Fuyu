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

export function categoryCounts(plugins: readonly MarketCatalogPlugin[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const plugin of plugins) for (const id of new Set(plugin.categories)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}

function rank(plugin: MarketCatalogPlugin): number {
  if (plugin.blocked || (plugin.revoked && !plugin.installedVersion)) return 3;
  if (!marketActionCandidate(plugin) && !plugin.installedVersion) return 2;
  return plugin.official ? 0 : 1;
}

function publishedAt(plugin: MarketCatalogPlugin): number {
  const at = offeredCandidate(plugin)?.publishedAt;
  const time = at ? Date.parse(at) : NaN;
  return Number.isFinite(time) ? time : 0;
}

export function sortPlugins(plugins: readonly MarketCatalogPlugin[], sort: PluginMarketSort): MarketCatalogPlugin[] {
  const indexed = plugins.map((plugin, index) => ({ plugin, index }));
  indexed.sort((a, b) => {
    if (sort === "recent") return publishedAt(b.plugin) - publishedAt(a.plugin) || a.index - b.index;
    return rank(a.plugin) - rank(b.plugin) || a.index - b.index;
  });
  return indexed.map(({ plugin }) => plugin);
}

export function browseList(plugins: readonly MarketCatalogPlugin[], sort: PluginMarketSort): MarketCatalogPlugin[] {
  return sortPlugins(plugins.filter((plugin) => !hasUpdate(plugin)), sort);
}

export function formatMarketTime(timestamp: number, locale: string, now = Date.now()): string {
  const at = new Date(timestamp);
  const sameDay = at.toDateString() === new Date(now).toDateString();
  const options: Intl.DateTimeFormatOptions = sameDay ? { hour: "2-digit", minute: "2-digit", hour12: false } : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  return at.toLocaleString(locale === "en" ? "en-GB" : "zh-CN", options);
}
