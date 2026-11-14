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
  settle(): Promise<unknown>;
  stop(): Promise<void>;
}

export function startHost(options: HostOptions): Promise<Host>;
export function pluginStatus(ctx: Context, logs?: LogEntry[]): PluginStatus[];
export function shareModules(entries: Record<string, string>): void;
