import { invoke } from "@tauri-apps/api/core";
import { emit, emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { PLUGIN_BAR_USAGE_REPORT, PLUGIN_BAR_USAGE_REQUEST, readBarUsageReport, type BarUsageReport } from "./barUsage.ts";
import { ISLAND_PLUGIN_PAGE_EVENT, islandPluginPageRequest, readIslandPluginPageRequest, type IslandPluginPageRequest } from "./islandPageRequest.ts";
import { ISLAND_PLUGIN_SPOTLIGHT_EVENT, readIslandSpotlightRequest, type IslandSpotlightRequest } from "./islandSpotlight.ts";
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
  | { state: "failed"; error: string; cause?: "network" | "disk" | "other" }
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

export const PLUGIN_PACKAGE_OPEN = "plugin-package-open";

export interface PendingPluginPackage {
  fileName: string;
  base64: string;
}

export function takePendingPluginPackage(): Promise<PendingPluginPackage | null> {
  return invoke<PendingPluginPackage | null>("take_pending_plugin_package");
}

export function onPluginPackageOpen(listener: () => void): Promise<UnlistenFn> {
  return listen(PLUGIN_PACKAGE_OPEN, () => listener());
}

export function requestPluginBarUsage(id: number): Promise<void> {
  return emitTo("main", PLUGIN_BAR_USAGE_REQUEST, { id });
}

export function onPluginBarUsageRequest(handler: (id: number) => void): Promise<UnlistenFn> {
  return listen<{ id?: unknown }>(PLUGIN_BAR_USAGE_REQUEST, ({ payload }) => {
    if (typeof payload?.id === "number") handler(payload.id);
  });
}

export function reportPluginBarUsage(report: BarUsageReport): Promise<void> {
  return emitTo("settings", PLUGIN_BAR_USAGE_REPORT, report);
}

export function onPluginBarUsageReport(handler: (report: BarUsageReport) => void): Promise<UnlistenFn> {
  return listen<unknown>(PLUGIN_BAR_USAGE_REPORT, ({ payload }) => {
    const report = readBarUsageReport(payload);
    if (report) handler(report);
  });
}

export function requestIslandPluginPage(pluginId: string, page?: string): Promise<void> {
  return emitTo("main", ISLAND_PLUGIN_PAGE_EVENT, islandPluginPageRequest(pluginId, page));
}

export function listenIslandPluginPageRequest(handler: (request: IslandPluginPageRequest) => void): Promise<UnlistenFn> {
  return listen<unknown>(ISLAND_PLUGIN_PAGE_EVENT, ({ payload }) => {
    const request = readIslandPluginPageRequest(payload);
    if (request) handler(request);
  });
}

export function requestIslandPluginSpotlight(pluginId: string): Promise<void> {
  const request: IslandSpotlightRequest = { pluginId };
  return emitTo("main", ISLAND_PLUGIN_SPOTLIGHT_EVENT, request);
}

export function listenIslandPluginSpotlight(handler: (request: IslandSpotlightRequest) => void): Promise<UnlistenFn> {
  return listen<unknown>(ISLAND_PLUGIN_SPOTLIGHT_EVENT, ({ payload }) => {
    const request = readIslandSpotlightRequest(payload);
    if (request) handler(request);
  });
}
