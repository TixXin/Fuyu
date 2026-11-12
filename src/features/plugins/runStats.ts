import type { PluginResources } from "./api";

const RUNTIME_NAMES: Record<string, string> = {
  "powershell.exe": "PowerShell",
  "node.exe": "Node.js",
};

export function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export type MemorySplit = {
  total: string;
  runtime: { name: string; megabytes: string; plugin: string } | null;
};

export function memorySplit(resources: PluginResources): MemorySplit {
  const total = megabytes(resources.memoryBytes);
  const host = resources.processes[0]?.name.toLowerCase() ?? "";
  const name = RUNTIME_NAMES[host];
  if (!name || resources.runtimeBytes === null || resources.runtimeBytes <= 0) return { total, runtime: null };
  const runtimeBytes = Math.min(resources.runtimeBytes, resources.memoryBytes);
  return {
    total,
    runtime: { name, megabytes: megabytes(runtimeBytes), plugin: megabytes(resources.memoryBytes - runtimeBytes) },
  };
}
