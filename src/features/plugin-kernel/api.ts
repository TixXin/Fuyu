import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  normalizeV2MigrationSnapshot,
  type V2MigrationDismissTarget,
  type V2MigrationSnapshot,
} from "./v2Migration.ts";

export type { V2MigrationDismissTarget, V2MigrationSnapshot } from "./v2Migration.ts";

export interface HostConnection {
  enabled: boolean;
  port: number | null;
  token: string | null;
  generation: number | null;
  safeMode?: HostSafeMode | null;
  node?: HostNodeStatus | null;
}

export type HostNodeStatus =
  | { state: "checking" }
  | { state: "downloading"; downloaded: number; total: number | null }
  | { state: "failed"; error: string }
  | { state: "ready" };

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

export function retryPluginHostNode(): Promise<boolean> {
  return invoke<boolean>("retry_plugin_host_node");
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
  config: Readonly<Record<string, unknown>>;
}

export type BuiltinConfigValue = boolean | number | string;

export const BUILTIN_PLUGINS_CHANGED = "builtin-plugins-changed";

export function getBuiltinPlugins(): Promise<BuiltinPlugin[]> {
  return invoke<BuiltinPlugin[]>("get_builtin_plugins");
}

export function setBuiltinPluginEnabled(id: string, enabled: boolean): Promise<BuiltinPlugin[]> {
  return invoke<BuiltinPlugin[]>("set_builtin_plugin_enabled", { id, enabled });
}

export function setBuiltinPluginConfig(id: string, key: string, value: BuiltinConfigValue | null): Promise<BuiltinPlugin[]> {
  return invoke<BuiltinPlugin[]>("set_builtin_plugin_config", { id, key, value });
}

export function onBuiltinPluginsChanged(handler: (plugins: unknown) => void): Promise<UnlistenFn> {
  return listen<unknown>(BUILTIN_PLUGINS_CHANGED, (event) => handler(event.payload));
}

export const BUILTIN_DIAGNOSTICS_REQUEST = "builtin-diagnostics-request";
export const BUILTIN_DIAGNOSTICS_REPORT = "builtin-diagnostics-report";

export interface BuiltinWindowUsage {
  id: string;
  items: number;
  listening: number;
  calls: number;
  services: number;
}

export interface BuiltinDiagnosticsReport {
  id: number;
  window: string;
  plugins: BuiltinWindowUsage[];
}

export function onBuiltinDiagnosticsRequest(handler: (id: number) => void): Promise<UnlistenFn> {
  return listen<{ id?: unknown }>(BUILTIN_DIAGNOSTICS_REQUEST, (event) => {
    if (typeof event.payload?.id === "number") handler(event.payload.id);
  });
}

export function reportBuiltinDiagnostics(report: BuiltinDiagnosticsReport): Promise<void> {
  return emit(BUILTIN_DIAGNOSTICS_REPORT, report);
}

export const V2_PLUGIN_MIGRATION_CHANGED = "v2-plugin-migration-changed";

export async function getV2PluginMigration(): Promise<V2MigrationSnapshot> {
  const raw = await invoke<unknown>("get_v2_plugin_migration");
  return normalizeV2MigrationSnapshot(raw);
}

export async function dismissV2PluginMigration(target: V2MigrationDismissTarget): Promise<V2MigrationSnapshot> {
  const raw = await invoke<unknown>("dismiss_v2_plugin_migration", { target });
  return normalizeV2MigrationSnapshot(raw);
}

export function onV2PluginMigrationChanged(handler: (snapshot: V2MigrationSnapshot) => void): Promise<UnlistenFn> {
  return listen<unknown>(V2_PLUGIN_MIGRATION_CHANGED, (event) => {
    handler(normalizeV2MigrationSnapshot(event.payload));
  });
}
