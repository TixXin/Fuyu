import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

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

export type BuiltinPluginKind = "essential" | "builtin";

export interface BackgroundStatus {
  name: string;
  registered: boolean;
  running: boolean;
}

export interface BuiltinPlugin {
  id: string;
  kind: BuiltinPluginKind;
  enabled: boolean;
  background: BackgroundStatus[];
}

export const BUILTIN_PLUGINS_CHANGED = "builtin-plugins-changed";

export function getBuiltinPlugins(): Promise<BuiltinPlugin[]> {
  return invoke<BuiltinPlugin[]>("get_builtin_plugins");
}

export function setBuiltinPluginEnabled(id: string, enabled: boolean): Promise<BuiltinPlugin[]> {
  return invoke<BuiltinPlugin[]>("set_builtin_plugin_enabled", { id, enabled });
}

export function onBuiltinPluginsChanged(handler: (plugins: unknown) => void): Promise<UnlistenFn> {
  return listen<unknown>(BUILTIN_PLUGINS_CHANGED, (event) => handler(event.payload));
}
