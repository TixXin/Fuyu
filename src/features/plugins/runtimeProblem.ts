import type { PluginRuntimeRequirement } from "./api.ts";
import { runsOn, type PluginPlatform } from "./platforms.ts";

export type RuntimeProblem = "platform" | "node" | "powershell";

export function runtimeProblem(
  platform: PluginPlatform,
  runtime: PluginRuntimeRequirement | null,
  platforms: readonly string[] | undefined,
  nodeAvailable: boolean,
  powershellAvailable: boolean,
): RuntimeProblem | null {
  if (!runsOn(platform, runtime, platforms)) return "platform";
  if (runtime === "node" && !nodeAvailable) return "node";
  if (runtime === "powershell" && !powershellAvailable) return "powershell";
  return null;
}
