import { invoke } from "@tauri-apps/api/core";

export interface HostConnection {
  enabled: boolean;
  port: number | null;
  token: string | null;
  generation: number | null;
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
