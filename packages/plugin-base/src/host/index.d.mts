import type { Context } from "cordis";
import type { ManifestIssue, ValidateManifestOptions } from "@fuyu/plugin-manifest";
import type { ServiceCallName } from "../protocol.mjs";
import type { ServiceEntry } from "../services.mjs";

export interface LogEntry {
  at: number;
  type: "error" | "warn" | "info" | "debug";
  name: string;
  text: string;
}

export type PluginState = "disabled" | "loading" | "waiting" | "running" | "failed" | "stopped" | "unloading" | "auto-disabled" | "safe-mode" | "bisect";

export type PluginKind = "essential" | "builtin" | "third-party";

export type SafeMode = "third-party" | "minimal";

export interface PluginUsage {
  cpuMs: number;
  calls: number;
  applyMs: number | null;
  timers: number;
  listeners: number;
  services: number;
  clients: number;
  errors: number;
}

export interface PluginStatus {
  id: string;
  name: string;
  state: PluginState;
  kind?: PluginKind;
  waitingFor?: string[];
  error?: string;
  reason?: string;
  blocked?: { by: "errors"; errors: number; windowMs: number } | { by: "safe-mode"; mode: SafeMode } | { by: "manifest"; errors: ManifestIssue[] } | { by: "bisect" };
  lastError?: { at: number; text: string };
  usage?: PluginUsage;
  source?: PluginSource;
  displayName?: Record<string, string>;
  undeclared?: { provides?: string[]; client?: string[]; slots?: string[]; commands?: string[]; network?: string[] };
  disabledServices?: string[];
  provides?: string[];
  replacedServices?: Array<{ service: string; by: string }>;
}

export type PluginSource = "builtin" | "market" | "manual" | "dev" | "file";

export interface HostInfo {
  pid: number;
  node: string;
  startedAt: number;
  safe: SafeMode | null;
  dev: boolean;
  rssBytes: number;
  heapUsedBytes: number;
  cpuMs: number;
}

export interface BisectAnswer {
  off: string[];
  unknown: string[];
}

export interface FaultLimit {
  errors: number;
  windowMs: number;
}

export interface ClientEntry {
  id: string;
  plugin: string;
  window: string;
  path: string;
  version: string;
}

export type { ServiceEntry, ServicesApi } from "../services.mjs";

export interface ServiceError extends Error {
  code: string;
  data?: unknown;
}

export interface ServiceWindows {
  connected(): string[];
  publish(name: string, data: unknown): void;
}

export interface ServiceHub {
  list(): ServiceEntry[];
  watch(onChange: (services: ServiceEntry[]) => void): () => void;
  attachWindows(windows: ServiceWindows): () => void;
  windowCall(method: ServiceCallName, params: unknown, window: string): unknown;
}

export function serviceError(code: string, message: string, data?: unknown): ServiceError;

export interface RustCallOptions {
  timeoutMs?: number;
  onProgress?: (data: any) => void;
}

export interface RustApi {
  call<Result = unknown>(method: string, params?: unknown, options?: RustCallOptions): Promise<Result>;
  on(event: string, listener: (data: any) => void): () => Promise<void>;
}

export interface HostRpc {
  handle(method: string, handler: (params: any) => unknown): void;
  call(method: string, params: unknown, options?: { timeoutMs?: number; onProgress?: (data: any) => void; signal?: unknown }): Promise<any>;
}

export const RUST_TIMEOUT_MS: number;
export function rustError(code: string, message: string, data?: unknown): ServiceError;
export class RustBridge {
  install(ctx: Context): () => void;
  attach(rpc: HostRpc): void;
  counts(): Record<string, number>;
}

export interface HostOptions {
  dir: string;
  config?: string;
  builtins?: string | null;
  dataDir?: string | null;
  appVersion?: string | null;
  apiNames?: string[];
  watch?: boolean;
  dev?: boolean;
  safe?: SafeMode | null;
  bisect?: string[];
  faultLimit?: Partial<FaultLimit>;
  onLog?: (entry: LogEntry) => void;
  rpc?: HostRpc | null;
  fetchImpl?: (input: any, init?: any) => Promise<any>;
}

export interface Host {
  ctx: Context;
  logs: LogEntry[];
  status(): PluginStatus[];
  watchStatus(onChange: (status: PluginStatus[]) => void, tickMs?: number): () => void;
  info(): HostInfo;
  builtins(): { id: string; kind: Exclude<PluginKind, "third-party"> }[];
  fault(plugin: string, error: unknown): boolean;
  bisect(off: string[]): BisectAnswer;
  clients(window?: string): ClientEntry[];
  timers(): Record<string, number>;
  rustListeners(): Record<string, number>;
  watchClients(onChange: (clients: ClientEntry[]) => void): () => void;
  serviceHub: ServiceHub;
  services(): ServiceEntry[];
  watchServices(onChange: (services: ServiceEntry[]) => void): () => void;
  settle(): Promise<unknown>;
  stop(): Promise<void>;
}

export function startHost(options: HostOptions): Promise<Host>;
export function pluginStatus(ctx: Context, logs?: LogEntry[]): PluginStatus[];
export const FAULT_LIMIT: FaultLimit;
export const KINDS: readonly PluginKind[];
export const SAFE_MODES: Record<SafeMode, readonly PluginKind[]>;
export function kindOf(options: { kind?: unknown } | undefined): PluginKind;
export function shareModules(entries: Record<string, string>): void;

export interface WindowSocket {
  port: number;
  token: string;
  publish(name: string, data: unknown): void;
  windows(): string[];
  close(): Promise<void>;
}

export interface WindowSocketOptions {
  origins: readonly string[];
  snapshot: () => unknown;
  onCall: (method: string, params: unknown, window: string) => unknown;
  helloWithinMs?: number;
  host?: string;
}

export function openWindowSocket(options: WindowSocketOptions): Promise<WindowSocket>;
export function watchStatus(ctx: Context, logs: LogEntry[], onChange: (status: PluginStatus[]) => void, options?: { delayMs?: number; tickMs?: number }): () => void;

export interface PluginWindowFile {
  window: string;
  file: string;
}

export interface DeclaredUse {
  provides: string[];
  client: string[];
  slots: string[];
  commands: string[];
  network: string[];
  experimental: string[];
}

export interface BuiltinPlugin {
  id: string;
  kind: Exclude<PluginKind, "third-party">;
  root: string;
  host: string | null;
  clients: PluginWindowFile[];
  declared: DeclaredUse | null;
  displayName?: Record<string, string> | null;
  commands?: Array<{ id: string; title: Record<string, string>; keybinding?: string }>;
  configSchema?: Record<string, unknown> | null;
}

export interface PluginPackage {
  package: string;
  version: string;
  displayName: Record<string, string> | null;
  host: string | null;
  clients: PluginWindowFile[];
  commands: Array<{ id: string; title: Record<string, string>; keybinding?: string }>;
  network: string[];
  experimental: string[];
  configSchema: Record<string, unknown> | null;
  declared: DeclaredUse;
}

export interface BuiltinCatalog {
  dir: string;
  plugins: BuiltinPlugin[];
}

export const BUILTINS_FILE: "builtins.json";
export const BUILTINS_FORMAT: 1;
export const BUILTIN_PREFIX: "builtin";
export function readBuiltins(dir: string): BuiltinCatalog;
export const DATA_DIR: "data";
export function dataDirOf(root: string, id: string): string;
export const PACKAGES_DIR: "packages";
export const DEV_PREFIX: "dev";
export const INSTALLED_SOURCES: readonly ["market", "manual"];
export const SOURCES: readonly ["market", "manual", "dev"];
export function readManifest(root: string, options: ValidateManifestOptions): PluginPackage;
export const KEYBINDINGS_FILE: "keybindings.json";
export const CONFIG_FILE: "config.json";
export const WINDOW_RULES_FILE: "window-rules.json";
export const MAX_WINDOWS_PER_PLUGIN: 8;
export const MAX_WINDOWS_TOTAL: 24;
