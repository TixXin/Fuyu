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

export interface SlotRule {
  kind?: "single" | "list";
  max?: number;
  perPlugin?: number;
}

export interface SlotItemInput {
  id: string;
  order?: number;
  component: unknown;
  [key: string]: unknown;
}

export interface SlotItem extends SlotItemInput {
  order: number;
  owner: string;
  seq: number;
  replaces?: string;
}

export interface SlotRegistry {
  define(name: string, rule?: SlotRule): void;
  add(name: string, item: SlotItemInput, owner: string): () => void;
  items(name: string): SlotItem[];
  names(): string[];
  subscribe(listener: (name: string) => void): () => void;
}

export declare class SlotError extends Error {
  code: "no-slot" | "bad-item" | "too-many";
}

export function createSlots(definitions?: Record<string, SlotRule>): SlotRegistry;

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

export function createLoader(options: {
  registry: SlotRegistry;
  base: string;
  importModule?: (url: string) => Promise<any>;
  checkFile?: (url: string) => Promise<void>;
  onStatus?: (status: Map<string, ClientStatus>) => void;
}): ClientLoader;
