import type { PluginRuntimeRequirement } from "./api.ts";

export type PluginPlatform = "windows" | "macos";

export function pluginPlatforms(runtime: PluginRuntimeRequirement | null, declared: readonly string[] | undefined): PluginPlatform[] {
  const known = (declared ?? []).filter((platform): platform is PluginPlatform => platform === "windows" || platform === "macos");
  if (known.length > 0) return known;
  return runtime === "exe" ? ["windows"] : ["windows", "macos"];
}

export function runsOn(platform: PluginPlatform, runtime: PluginRuntimeRequirement | null, declared: readonly string[] | undefined) {
  return pluginPlatforms(runtime, declared).includes(platform);
}
