import type { MarketCatalogPlugin } from "@fuyu/plugin-services";
import type { PinyinOf } from "../../lib/pinyin/pinyin.ts";

export type SearchablePlugin = MarketCatalogPlugin & { keywords?: readonly string[] };
export type MarketSearchRank = 0 | 1 | 2;

const HAN = /[㐀-鿿]/;
const LATIN = /^[a-z]+$/;
const MAX_CACHED = 600;

const squash = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");
const cache = new Map<string, { full: string; initials: string }>();

function pinyinOfText(text: string, pinyin: PinyinOf) {
  let entry = cache.get(text);
  if (!entry) {
    entry = pinyin(text);
    if (cache.size >= MAX_CACHED) cache.clear();
    cache.set(text, entry);
  }
  return entry;
}

export function queryWantsPinyin(query: string): boolean {
  return LATIN.test(squash(query.trim()));
}

function holdsName(query: string, name: string): boolean {
  return name.length >= (HAN.test(name) ? 2 : 4) && query.includes(name);
}

function pinyinHit(text: string, query: string, pinyin: PinyinOf): boolean {
  if (!HAN.test(text)) return false;
  const { full, initials } = pinyinOfText(text, pinyin);
  return full.startsWith(query) || (query.length >= 3 && full.includes(query)) || (query.length >= 2 && initials.includes(query));
}

export function marketSearchRank(plugin: SearchablePlugin, query: string, categoryNames: Readonly<Record<string, string>> = {}, pinyin: PinyinOf | null = null): MarketSearchRank | null {
  const q = squash(query.trim());
  if (!q) return 0;
  const names = [plugin.displayName["zh-CN"], plugin.displayName.en].filter(Boolean);
  if (squash(plugin.name).includes(q) || names.map(squash).some((name) => name.includes(q) || holdsName(q, name))) return 0;
  const keywords = (plugin.keywords ?? []).filter((word) => typeof word === "string" && word.trim() !== "");
  const aliases = [...keywords, ...plugin.categories.map((id) => categoryNames[id] ?? id)];
  if (aliases.some((alias) => squash(alias).includes(q))) return 1;
  if (pinyin && LATIN.test(q) && [...names, ...keywords].some((text) => pinyinHit(text, q, pinyin))) return 1;
  const rest = [plugin.publisher.github, plugin.description["zh-CN"], plugin.description.en];
  return rest.some((text) => Boolean(text) && squash(text).includes(q)) ? 2 : null;
}

export function matchesQuery(plugin: SearchablePlugin, query: string, categoryNames: Readonly<Record<string, string>> = {}, pinyin: PinyinOf | null = null): boolean {
  return marketSearchRank(plugin, query, categoryNames, pinyin) !== null;
}

export function searchMarket<T extends SearchablePlugin>(plugins: readonly T[], query: string, categoryNames: Readonly<Record<string, string>> = {}, pinyin: PinyinOf | null = null): T[] {
  return plugins
    .flatMap((plugin, index) => {
      const rank = marketSearchRank(plugin, query, categoryNames, pinyin);
      return rank === null ? [] : [{ plugin, index, rank }];
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ plugin }) => plugin);
}

export const FEW_SETTINGS_RESULTS = 4;

export function marketSuggestions<T extends SearchablePlugin>(plugins: readonly T[], query: string, settingsResults: number, categoryNames: Readonly<Record<string, string>> = {}, pinyin: PinyinOf | null = null): T[] {
  if (squash(query.trim()).length < 2 || settingsResults > FEW_SETTINGS_RESULTS) return [];
  const nothing = settingsResults === 0;
  const worst: MarketSearchRank = nothing ? 2 : 1;
  return plugins
    .flatMap((plugin, index) => {
      if (plugin.revoked && !plugin.installedVersion) return [];
      const rank = marketSearchRank(plugin, query, categoryNames, pinyin);
      return rank === null || rank > worst ? [] : [{ plugin, index, rank, owned: plugin.installedVersion ? 1 : 0 }];
    })
    .sort((a, b) => a.rank - b.rank || a.owned - b.owned || a.index - b.index)
    .slice(0, nothing ? 5 : 3)
    .map(({ plugin }) => plugin);
}
