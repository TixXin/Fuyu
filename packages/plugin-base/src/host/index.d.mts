import type { Context } from "cordis";

export interface LogEntry {
  at: number;
  type: "error" | "warn" | "info" | "debug";
  name: string;
  text: string;
}

export type PluginState = "disabled" | "loading" | "waiting" | "running" | "failed" | "stopped" | "unloading";

export interface PluginStatus {
  id: string;
  name: string;
  state: PluginState;
  waitingFor?: string[];
  error?: string;
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
  onLog?: (entry: LogEntry) => void;
}

export interface Host {
  ctx: Context;
  logs: LogEntry[];
  status(): PluginStatus[];
  watchStatus(onChange: (status: PluginStatus[]) => void): () => void;
  clients(window?: string): ClientEntry[];
  timers(): Record<string, number>;
  watchClients(onChange: (clients: ClientEntry[]) => void): () => void;
  settle(): Promise<unknown>;
  stop(): Promise<void>;
}

export function startHost(options: HostOptions): Promise<Host>;
export function pluginStatus(ctx: Context, logs?: LogEntry[]): PluginStatus[];
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
export function watchStatus(ctx: Context, logs: LogEntry[], onChange: (status: PluginStatus[]) => void, delayMs?: number): () => void;
