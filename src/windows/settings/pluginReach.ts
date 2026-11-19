import type { InstalledPluginReach, MarketCatalogPlugin } from "@fuyu/plugin-services";

export type PluginPlace = "page" | "bar" | "alerts" | "translate" | "settings";

export type VersionStanding = "newer" | "older" | "same";

const SLOT_PLACES: readonly (readonly [string, PluginPlace])[] = [["island.page/v1", "page"], ["island.collapsed/v1", "bar"]];
const SERVICE_PLACES: readonly (readonly [string, PluginPlace])[] = [["messages/v1", "alerts"], ["translator.engines", "translate"]];

export function pluginSettingsKnown(reach: InstalledPluginReach | null | undefined, ownSections: boolean): boolean | null {
  if (ownSections) return true;
  if (!reach) return null;
  return reach.config || reach.slots.includes("settings.section/v1");
}

export function pluginPlaces(reach: InstalledPluginReach | null | undefined, settings: boolean | null): PluginPlace[] {
  const places: PluginPlace[] = [];
  for (const [slot, place] of SLOT_PLACES) if (reach?.slots.includes(slot)) places.push(place);
  for (const [service, place] of SERVICE_PLACES) if (reach?.services.includes(service)) places.push(place);
  if (settings === true) places.push("settings");
  return places;
}

function parts(version: string): { core: number[]; pre: boolean } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(?:\+.*)?$/.exec(version.trim());
  return match ? { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] !== undefined } : null;
}

export function compareLooseVersions(a: string, b: string): number | null {
  const [left, right] = [parts(a), parts(b)];
  if (!left || !right) return null;
  for (let index = 0; index < 3; index += 1) {
    const diff = left.core[index] - right.core[index];
    if (diff !== 0) return Math.sign(diff);
  }
  return left.pre === right.pre ? 0 : left.pre ? -1 : 1;
}

export function newestMarketVersion(market: MarketCatalogPlugin | undefined): string | null {
  const versions = [market?.install?.version, market?.manual?.version].filter((item): item is string => Boolean(item));
  return versions.reduce<string | null>((best, item) => (best === null || (compareLooseVersions(item, best) ?? 0) > 0 ? item : best), null);
}

export function versionStanding(local: string | null, market: string | null): VersionStanding | null {
  if (!local || !market) return null;
  const order = compareLooseVersions(local, market);
  return order === null ? null : order > 0 ? "newer" : order < 0 ? "older" : "same";
}
