import { useEffect, useState } from "react";
import { connectHost, type ConnectionState } from "@fuyu/plugin-base/client";
import { getPluginHostConnection, getPluginHostMemory, type HostMemory, type HostSafeMode } from "../../features/plugin-kernel/api";
import { loadDevBuild } from "../../lib/platform";
import { visibilityInterval } from "../../lib/useVisibilityInterval";

export type PluginKindV3 = "essential" | "builtin" | "third-party";

export interface PluginUsageV3 {
  cpuMs: number;
  calls: number;
  applyMs: number | null;
  timers: number;
  listeners: number;
  services: number;
  clients: number;
  errors: number;
}

export interface PluginStatusV3 {
  id: string;
  name: string;
  state: string;
  kind?: PluginKindV3;
  source?: string;
  undeclared?: { provides?: string[]; client?: string[] };
  waitingFor?: string[];
  provides?: string[];
  disabledServices?: string[];
  replacedServices?: { service: string; by: string }[];
  error?: string;
  reason?: string;
  blocked?: { by: "errors"; errors: number; windowMs: number } | { by: "safe-mode"; mode: "third-party" | "minimal" };
  lastError?: { at: number; text: string };
  usage?: PluginUsageV3;
}

export interface HostInfoV3 {
  pid: number;
  node: string;
  startedAt: number;
  safe: "third-party" | "minimal" | null;
  dev: boolean;
  rssBytes: number;
  heapUsedBytes: number;
  cpuMs: number;
}

export interface PluginHostSnapshot {
  plugins?: PluginStatusV3[];
  host?: HostInfoV3;
}

export interface PluginHostHandlers {
  onSnapshot: (snapshot: PluginHostSnapshot) => void;
  onEvent: (name: string, data: unknown) => void;
  onState: (state: ConnectionState) => void;
}

export type PluginV3StateWithBisect = "bisect";

export type PluginHostConnector = (handlers: PluginHostHandlers) => {
  close(): void;
  call?: (method: string, params?: unknown) => Promise<unknown>;
};

export interface PluginHostView {
  connection: ConnectionState;
  plugins: PluginStatusV3[] | null;
  host: HostInfoV3 | null;
  memory: HostMemory | null;
  safeMode: HostSafeMode | null;
  bisect?: (off: readonly string[]) => Promise<{ off: string[]; unknown: string[] }>;
}

async function target() {
  const connection = await getPluginHostConnection();
  return connection.port !== null && connection.token !== null ? { port: connection.port, token: connection.token } : null;
}

export const connectSettingsToHost: PluginHostConnector = (handlers) =>
  connectHost<PluginHostSnapshot>({ resolve: target, window: "settings", ...handlers });

let hostEnabled: Promise<boolean> | null = null;

export function loadPluginHostEnabled(): Promise<boolean> {
  hostEnabled ??= getPluginHostConnection()
    .then((connection) => connection?.enabled === true)
    .catch(() => false);
  return hostEnabled;
}

export function loadPluginsV3Enabled(): Promise<boolean> {
  return Promise.all([loadPluginHostEnabled(), loadDevBuild()]).then(([host, dev]) => host || dev);
}

function useLoaded(load: () => Promise<boolean>): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((value) => {
      if (live) setOn(value);
    });
    return () => {
      live = false;
    };
  }, [load]);
  return on;
}

export function usePluginsV3Enabled(): boolean {
  return useLoaded(loadPluginsV3Enabled) === true;
}

export function usePluginHostEnabled(): boolean | null {
  return useLoaded(loadPluginHostEnabled);
}

const START: PluginHostView = { connection: "connecting", plugins: null, host: null, memory: null, safeMode: null };

const MEMORY_EVERY_MS = 5000;

export function usePluginHostStatus(connect: PluginHostConnector = connectSettingsToHost): PluginHostView {
  const [view, setView] = useState<PluginHostView>(START);
  useEffect(() => {
    const connection = connect({
      onSnapshot: (snapshot) => setView((current) => ({ ...current, plugins: snapshot.plugins ?? [], host: snapshot.host ?? null })),
      onEvent: (name, data) => {
        if (name === "plugins") setView((current) => ({ ...current, plugins: data as PluginStatusV3[] }));
        if (name === "host") setView((current) => ({ ...current, host: data as HostInfoV3 }));
      },
      onState: (state) => setView((current) => ({ ...current, connection: state })),
    });
    const runBisect = typeof connection.call === "function"
      ? async (off: readonly string[]) => {
          const res = (await connection.call!("bisect", { off: [...off] })) as { off?: string[]; unknown?: string[] } | null;
          return { off: res?.off ?? [...off], unknown: res?.unknown ?? [] };
        }
      : undefined;
    setView((current) => ({ ...current, bisect: runBisect }));
    return () => connection.close();
  }, [connect]);
  const pid = view.connection === "open" ? view.host?.pid ?? null : null;
  useEffect(() => {
    if (pid === null) return;
    let live = true;
    const read = () =>
      void getPluginHostMemory()
        .then((memory) => {
          if (live) setView((current) => ({ ...current, memory: memory?.pid === pid ? memory : null }));
        })
        .catch(() => undefined);
    read();
    void getPluginHostConnection()
      .then((connection) => {
        if (live) setView((current) => ({ ...current, safeMode: connection.safeMode ?? null }));
      })
      .catch(() => undefined);
    const stop = visibilityInterval(read, MEMORY_EVERY_MS);
    return () => {
      live = false;
      stop();
    };
  }, [pid]);
  return view;
}
