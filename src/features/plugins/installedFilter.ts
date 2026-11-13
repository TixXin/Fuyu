import type { PluginInfo } from "./api.ts";

export const INSTALLED_FILTERS = ["all", "running", "updates", "attention"] as const;
export type InstalledFilter = (typeof INSTALLED_FILTERS)[number];

type FilterablePlugin = Pick<
  PluginInfo,
  | "id"
  | "builtin"
  | "dev"
  | "name"
  | "description"
  | "author"
  | "enabled"
  | "needsApproval"
  | "hasProcess"
  | "status"
  | "error"
  | "invalidReason"
  | "revoked"
  | "updateAvailable"
  | "autoUpdated"
  | "keybindingConflicts"
>;

const isOn = (plugin: FilterablePlugin) => plugin.enabled && !plugin.needsApproval;
const canRun = (plugin: FilterablePlugin, allowed: boolean) => allowed || plugin.builtin || plugin.dev;

export function isRunning(plugin: FilterablePlugin, allowed: boolean) {
  return isOn(plugin) && canRun(plugin, allowed) && plugin.hasProcess && plugin.status === "running";
}

export function hasPendingUpdate(plugin: FilterablePlugin) {
  return Boolean(plugin.updateAvailable) && plugin.updateAvailable !== plugin.autoUpdated;
}

export function needsAttention(plugin: FilterablePlugin, allowed: boolean) {
  if (plugin.invalidReason || plugin.revoked || plugin.needsApproval) return true;
  if (plugin.keybindingConflicts.length > 0) return true;
  if (!isOn(plugin)) return false;
  if (!canRun(plugin, allowed)) return true;
  return plugin.hasProcess && (plugin.status === "crashed" || Boolean(plugin.error));
}

export function matchesInstalledQuery(plugin: FilterablePlugin, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [
    plugin.id,
    plugin.name?.["zh-CN"] ?? "",
    plugin.name?.en ?? "",
    plugin.description?.["zh-CN"] ?? "",
    plugin.description?.en ?? "",
    plugin.author,
  ]
    .join("\n")
    .toLowerCase();
  return words.every((word) => text.includes(word));
}

export function installedCounts(plugins: readonly FilterablePlugin[], allowed: boolean): Record<InstalledFilter, number> {
  return {
    all: plugins.length,
    running: plugins.filter((plugin) => isRunning(plugin, allowed)).length,
    updates: plugins.filter(hasPendingUpdate).length,
    attention: plugins.filter((plugin) => needsAttention(plugin, allowed)).length,
  };
}

export function filterInstalledPlugins<T extends FilterablePlugin>(
  plugins: readonly T[],
  filter: InstalledFilter,
  query: string,
  allowed: boolean,
): T[] {
  return plugins.filter((plugin) => {
    if (!matchesInstalledQuery(plugin, query)) return false;
    if (filter === "running") return isRunning(plugin, allowed);
    if (filter === "updates") return hasPendingUpdate(plugin);
    if (filter === "attention") return needsAttention(plugin, allowed);
    return true;
  });
}

export type PluginHealth = "running" | "busy" | "error" | "off" | "idle";

export function pluginHealth(plugin: FilterablePlugin, allowed: boolean): PluginHealth {
  if (plugin.invalidReason || plugin.revoked) return "error";
  if (!isOn(plugin)) return "off";
  if (!canRun(plugin, allowed)) return "error";
  if (!plugin.hasProcess) return "idle";
  if (plugin.status === "crashed" || plugin.error) return "error";
  if (plugin.status === "starting" || plugin.status === "restarting") return "busy";
  if (plugin.status === "running") return "running";
  return "idle";
}
