import type { PluginsSnapshot } from "./api";

export type BuiltinPluginState = {
  enabled: boolean;
  settings: Record<string, unknown>;
};

export const BUILTIN_PLUGIN_OFF: BuiltinPluginState = { enabled: false, settings: {} };

export function builtinPluginState(snapshot: PluginsSnapshot | null, id: string): BuiltinPluginState {
  const plugin = snapshot?.plugins.find((entry) => entry.id === id && entry.builtin);
  if (!plugin) return BUILTIN_PLUGIN_OFF;
  return { enabled: plugin.enabled && plugin.status === "running", settings: plugin.settings };
}
