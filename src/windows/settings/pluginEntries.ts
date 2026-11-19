import type { InstalledMarketPlugin, MarketCatalogPlugin, MarketCatalogSnapshot, MarketLocalizedText, MarketRevocation } from "@fuyu/plugin-services";
import { isExternalPlugin } from "./pluginDisplay.ts";
import { iconSources, packageIconUrl } from "./pluginIconSources.ts";
import { pluginRowStatus, type RowContext, type RowStatus } from "./pluginRowStatus.ts";
import { stateOf } from "./pluginServiceStatus.ts";
import type { PluginStatusV3 } from "./usePluginHostStatus";

export type PluginSourceKind = "official" | "market" | "manual" | "local";

export interface InstalledEntry {
  id: string;
  plugin: PluginStatusV3;
  market?: MarketCatalogPlugin;
  title: string;
  icons: string[];
  description: string | null;
  version: string | null;
  publisher: string | null;
  source: PluginSourceKind;
  managed: boolean;
  removable: boolean;
  enabled: boolean;
  revocation?: MarketRevocation | null;
  status: RowStatus;
}

export type InstalledFilter = "all" | "on" | "off" | "attention";

export function localized(value: MarketLocalizedText | string | undefined | null, locale: string): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  const text = locale === "en" ? value.en || value["zh-CN"] : value["zh-CN"] || value.en;
  return text?.trim() || null;
}

function titleOf(plugin: PluginStatusV3, market: MarketCatalogPlugin | undefined, installed: InstalledMarketPlugin | undefined, locale: string): string {
  const fromMarket = localized(market?.displayName, locale) ?? localized(installed?.displayName, locale);
  if (fromMarket) return fromMarket;
  const raw = plugin.name?.trim();
  if (!raw || raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("file:")) return plugin.id;
  return raw;
}

function sourceOf(plugin: PluginStatusV3, market: MarketCatalogPlugin | undefined): PluginSourceKind {
  if (plugin.source === "manual") return "manual";
  if (plugin.source === "market") return market?.official || plugin.id.startsWith("@fuyu/") ? "official" : "market";
  return "local";
}

export function installedEntries(
  plugins: readonly PluginStatusV3[] | null,
  builtinIds: ReadonlySet<string>,
  snapshot: MarketCatalogSnapshot | null,
  context: RowContext,
  locale: string,
): InstalledEntry[] {
  const marketByName = new Map((snapshot?.plugins ?? []).map((item) => [item.name, item]));
  const installedById = new Map((snapshot?.installed ?? []).map((item) => [item.id, item]));
  return (plugins ?? [])
    .filter((plugin) => isExternalPlugin(plugin, builtinIds))
    .map((plugin) => {
      const market = marketByName.get(plugin.id);
      const installed = installedById.get(plugin.id);
      const source = sourceOf(plugin, market);
      const revocation = market?.revocation ?? installed?.revocation ?? null;
      return {
        id: plugin.id,
        plugin,
        market,
        title: titleOf(plugin, market, installed, locale),
        icons: iconSources(packageIconUrl(plugin.id, installed?.icon), market?.icon),
        description: localized(market?.description, locale) ?? localized(installed?.description, locale),
        version: installed?.version ?? market?.installedVersion ?? null,
        publisher: source === "official" ? null : market?.publisher.github ?? (plugin.id.includes("/") ? plugin.id.split("/")[0].replace(/^@/, "") : null),
        source,
        managed: plugin.source === "market" || plugin.source === "manual",
        removable: plugin.source === "market" || plugin.source === "manual" || plugin.source === "dev" || plugin.source === "file",
        enabled: stateOf(plugin) !== "disabled",
        revocation,
        status: pluginRowStatus(plugin, market, context, revocation),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, locale));
}

export function countEntries(entries: readonly InstalledEntry[]): Record<InstalledFilter, number> {
  return {
    all: entries.length,
    on: entries.filter((entry) => entry.enabled).length,
    off: entries.filter((entry) => !entry.enabled).length,
    attention: entries.filter((entry) => entry.status.attention).length,
  };
}

export function matchesEntry(entry: InstalledEntry, filter: InstalledFilter, query: string): boolean {
  if (filter === "on" && !entry.enabled) return false;
  if (filter === "off" && entry.enabled) return false;
  if (filter === "attention" && !entry.status.attention) return false;
  const q = query.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!q) return true;
  const haystack = [entry.id, entry.title, entry.description, entry.publisher, entry.market?.displayName.en, entry.market?.displayName["zh-CN"]]
    .filter(Boolean).join(" ").toLowerCase().replace(/[\s_-]+/g, "");
  return haystack.includes(q);
}
