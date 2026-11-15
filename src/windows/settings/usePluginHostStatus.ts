import { useEffect, useState } from "react";
import { connectHost, type ConnectionState } from "@fuyu/plugin-base/client";
import { getPluginHostConnection } from "../../features/plugin-kernel/api";

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
  waitingFor?: string[];
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

export type PluginHostConnector = (handlers: PluginHostHandlers) => { close(): void };

export interface PluginHostView {
  connection: ConnectionState;
  plugins: PluginStatusV3[] | null;
  host: HostInfoV3 | null;
}

async function target() {
  const connection = await getPluginHostConnection();
  return connection.port !== null && connection.token !== null ? { port: connection.port, token: connection.token } : null;
}

export const connectSettingsToHost: PluginHostConnector = (handlers) =>
  connectHost<PluginHostSnapshot>({ resolve: target, window: "settings", ...handlers });

let enabled: Promise<boolean> | null = null;

export function loadPluginsV3Enabled(): Promise<boolean> {
  enabled ??= getPluginHostConnection()
    .then((connection) => connection?.enabled === true)
    .catch(() => false);
  return enabled;
}

export function usePluginsV3Enabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void loadPluginsV3Enabled().then((value) => {
      if (live) setOn(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return on;
}

const START: PluginHostView = { connection: "connecting", plugins: null, host: null };

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
    return () => connection.close();
  }, [connect]);
  return view;
}
