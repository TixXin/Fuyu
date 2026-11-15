import { invoke } from "@tauri-apps/api/core";

export interface HostConnection {
  enabled: boolean;
  port: number | null;
  token: string | null;
  generation: number | null;
  safeMode?: HostSafeMode | null;
}

export interface HostSafeMode {
  mode: "third-party" | "minimal";
  cause: "variable" | "shift" | "failures";
  failures: number;
}

export function getPluginHostConnection(): Promise<HostConnection> {
  return invoke<HostConnection>("get_plugin_host_connection");
}

export type HostMemoryMeasure = "private-working-set" | "phys-footprint";

export interface HostMemory {
  pid: number;
  bytes: number;
  measure: HostMemoryMeasure;
}

export function getPluginHostMemory(): Promise<HostMemory | null> {
  return invoke<HostMemory | null>("get_plugin_host_memory");
}

export function exitPluginSafeMode(): Promise<boolean> {
  return invoke<boolean>("exit_plugin_safe_mode");
}
