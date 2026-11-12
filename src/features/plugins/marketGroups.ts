import type { MarketPlugin } from "./api.ts";
import { isNewerVersion } from "./version.ts";

const TONES = ["productivity", "todos", "developer", "media", "messages", "information", "utilities", "sounds"] as const;
export type MarketIconTone = (typeof TONES)[number];

export const hasUpdate = (plugin: Pick<MarketPlugin, "installedVersion" | "version">) =>
  plugin.installedVersion !== null && isNewerVersion(plugin.version, plugin.installedVersion);

export function groupMarketPlugins<T extends Pick<MarketPlugin, "installedVersion" | "version">>(plugins: readonly T[]) {
  return {
    updates: plugins.filter(hasUpdate),
    installable: plugins.filter((plugin) => plugin.installedVersion === null),
    installed: plugins.filter((plugin) => plugin.installedVersion !== null && !hasUpdate(plugin)),
  };
}

export function pluginInitial(name: string) {
  const trimmed = name.replace(/^[\s"'“‘「（(【[]+/u, "");
  const first = [...trimmed][0] ?? "?";
  return first.toLocaleUpperCase();
}

export function pluginIconTone(plugin: Pick<MarketPlugin, "id" | "categories">): MarketIconTone {
  const category = plugin.categories.find((name): name is MarketIconTone => (TONES as readonly string[]).includes(name));
  if (category) return category;
  let hash = 0;
  for (const char of plugin.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}
