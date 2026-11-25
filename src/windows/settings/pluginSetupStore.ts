import type { PluginStatus } from "./usePluginHostStatus";

export interface PluginSetupNeed {
  hint: string | null;
}

let latest: readonly PluginStatus[] | null = null;
const listeners = new Set<() => void>();

export function publishPluginStatuses(plugins: readonly PluginStatus[] | null) {
  latest = plugins;
  for (const listener of [...listeners]) listener();
}

export function subscribePluginStatuses(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function latestPluginStatuses(): readonly PluginStatus[] | null {
  return latest;
}

function hintText(hint: NonNullable<PluginStatus["setup"]>["hint"], locale: string): string | null {
  if (!hint) return null;
  if (typeof hint === "string") return hint.trim() || null;
  const text = locale === "en" ? hint.en || hint["zh-CN"] : hint["zh-CN"] || hint.en;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

export function pluginSetupNeed(plugin: PluginStatus | undefined | null, live: boolean, locale: string): PluginSetupNeed | null {
  if (!plugin?.setup || !live || plugin.state !== "running") return null;
  return { hint: hintText(plugin.setup.hint, locale) };
}
