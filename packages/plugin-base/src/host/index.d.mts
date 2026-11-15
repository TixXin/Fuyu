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
