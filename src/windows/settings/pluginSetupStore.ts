import type { PluginStatusV3 } from "./usePluginHostStatus";

export interface PluginSetupNeed {
  hint: string | null;
}

let latest: readonly PluginStatusV3[] | null = null;
const listeners = new Set<() => void>();

export function publishPluginStatuses(plugins: readonly PluginStatusV3[] | null) {
  latest = plugins;
  for (const listener of [...listeners]) listener();
}

export function subscribePluginStatuses(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function latestPluginStatuses(): readonly PluginStatusV3[] | null {
  return latest;
}

function hintText(hint: NonNullable<PluginStatusV3["setup"]>["hint"], locale: string): string | null {
  if (!hint) return null;
  if (typeof hint === "string") return hint.trim() || null;
  const text = locale === "en" ? hint.en || hint["zh-CN"] : hint["zh-CN"] || hint.en;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

export function pluginSetupNeed(plugin: PluginStatusV3 | undefined | null, live: boolean, locale: string): PluginSetupNeed | null {
  if (!plugin?.setup || !live || plugin.state !== "running") return null;
  return { hint: hintText(plugin.setup.hint, locale) };
}
