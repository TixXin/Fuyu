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
