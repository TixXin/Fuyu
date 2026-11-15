import type { Context } from "cordis";

export interface LogEntry {
  at: number;
  type: "error" | "warn" | "info" | "debug";
  name: string;
  text: string;
}

export type PluginState = "disabled" | "loading" | "waiting" | "running" | "failed" | "stopped" | "unloading" | "auto-disabled" | "safe-mode";

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
  blocked?: { by: "errors"; errors: number; windowMs: number } | { by: "safe-mode"; mode: SafeMode };
  lastError?: { at: number; text: string };
  usage?: PluginUsage;
}

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

export interface ServiceEntry {
  name: string;
  plugin: string;
  methods: string[];
  events: string[];
}

export interface ServiceDefinitionShape {
  readonly name: string;
  readonly methods: { readonly [method: string]: { readonly timeoutMs?: number; readonly progress?: true } };
  readonly events: { readonly [event: string]: object };
}

export interface ServiceError extends Error {
  code: string;
  data?: unknown;
}

export interface ServiceCaller {
  readonly plugin?: string;
  readonly window?: string;
  progress(chunk: unknown): void;
}

export interface ServiceHandle {
  emit(event: string, data?: unknown): boolean;
  dispose(): Promise<void>;
}

export interface ServicesApi {
  provide(definition: ServiceDefinitionShape, impl: Record<string, (params: any, caller: ServiceCaller) => unknown>): ServiceHandle;
  get(definition: ServiceDefinitionShape): Record<string, (params?: any, options?: { timeoutMs?: number; onProgress?: (chunk: any) => void }) => Promise<any>> & {
    on(event: string, listener: (data: any) => void): () => Promise<void>;
  };
  list(): ServiceEntry[];
}

export interface ServiceWindows {
  connected(): string[];
  publish(name: string, data: unknown): void;
}

export interface ServiceHub {
  list(): ServiceEntry[];
  watch(onChange: (services: ServiceEntry[]) => void): () => void;
  attachWindows(windows: ServiceWindows): () => void;
  windowCall(method: "service.call" | "service.on" | "service.off", params: unknown, window: string): unknown;
}

export const SERVICE_NAME: RegExp;
export const SERVICE_TIMEOUT_MS: number;
export const SERVICE_CALLS: ReadonlySet<"service.call" | "service.on" | "service.off">;
export function serviceError(code: string, message: string, data?: unknown): ServiceError;

export interface HostOptions {
  dir: string;
  config?: string;
  apiNames?: string[];
  watch?: boolean;
  dev?: boolean;
  safe?: SafeMode | null;
  faultLimit?: Partial<FaultLimit>;
  onLog?: (entry: LogEntry) => void;
}

export interface Host {
  ctx: Context;
  logs: LogEntry[];
  status(): PluginStatus[];
  watchStatus(onChange: (status: PluginStatus[]) => void, tickMs?: number): () => void;
  info(): HostInfo;
  fault(plugin: string, error: unknown): boolean;
  clients(window?: string): ClientEntry[];
  timers(): Record<string, number>;
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
