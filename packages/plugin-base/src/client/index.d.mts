export type ConnectionState = "connecting" | "open" | "reconnecting" | "failed" | "closed";

export interface HostTarget {
  port: number;
  token: string;
}

export interface SnapshotInfo {
  seq: number;
  fresh: boolean;
}

export interface MinimalSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "message" | "close", listener: (event: any) => void): void;
}

export interface ConnectOptions<Snapshot = unknown> {
  resolve: () => Promise<HostTarget | null>;
  window: string;
  onSnapshot?: (snapshot: Snapshot, info: SnapshotInfo) => void;
  onEvent?: (name: string, data: unknown) => void;
  onState?: (state: ConnectionState, detail?: string) => void;
  open?: (url: string) => MinimalSocket;
  retryMs?: number[];
  callTimeoutMs?: number;
}

export interface HostConnection {
  readonly state: ConnectionState;
  call<T = unknown>(method: string, params?: unknown, options?: { timeoutMs?: number }): Promise<T>;
  close(): void;
}

export declare class HostCallError extends Error {
  code: string;
  data?: unknown;
}

export function connectHost<Snapshot = unknown>(options: ConnectOptions<Snapshot>): HostConnection;

export { BUILTIN, createSlots, SlotError, slotWindow, type SlotAddOptions, type SlotErrorCode, type SlotItem, type SlotItemInput, type SlotRegistry, type SlotRule } from "./slots.mjs";
import type { SlotItemInput, SlotRegistry } from "./slots.mjs";

export declare class Slots {
  add(name: string, item: SlotItemInput): () => Promise<void>;
}

export interface ClientEntry {
  id: string;
  plugin: string;
  window: string;
  path: string;
  version: string;
}

export interface ClientStatus {
  plugin: string;
  state: "loading" | "running" | "failed";
  error?: string;
}

export interface ClientLoader {
  sync(entries: ClientEntry[]): Promise<void>;
  status(): Map<string, ClientStatus>;
  stop(): Promise<unknown>;
}

export interface PluginMessage {
  plugin: string;
  topic: string;
  data: unknown;
}

export interface Bridge {
  call(plugin: string, method: string, params?: unknown): Promise<unknown>;
  subscribe(listener: (message: PluginMessage) => void): () => void;
  deliver(message: PluginMessage): void;
}

export function createBridge(call: (method: string, params?: unknown) => Promise<unknown>): Bridge;

export function createLoader(options: {
  registry: SlotRegistry;
  bridge?: Bridge;
  base: string;
  importModule?: (url: string) => Promise<any>;
  checkFile?: (url: string) => Promise<void>;
  onStatus?: (status: Map<string, ClientStatus>) => void;
}): ClientLoader;
export { createServiceProxy, type ServiceCall, type ServiceEventMessage, type ServiceProxy } from "./services.mjs";
