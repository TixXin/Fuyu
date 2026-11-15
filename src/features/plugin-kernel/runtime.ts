import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { connectHost, createLoader, createSlots, type ClientEntry, type ClientLoader, type HostConnection as Connection, type SlotRegistry, type SlotRule } from "@fuyu/plugin-base/client";
import { installShared } from "@fuyu/plugin-base/client/react";
import { isMacOS } from "../../lib/platform";
import { getPluginHostConnection } from "./api";

export const PLUGIN_SLOTS: Record<string, SlotRule> = {
  "island.dev/v1": { kind: "list", max: 3, perPlugin: 1 },
};

export interface PluginRuntime {
  registry: SlotRegistry;
  loader: ClientLoader;
  connection: Connection;
}

const PLUGIN_BASE = isMacOS ? "fuyu-plugin://localhost" : "http://fuyu-plugin.localhost";
const runtimes = new Map<string, Promise<PluginRuntime | null>>();

async function target() {
  const connection = await getPluginHostConnection();
  return connection.port !== null && connection.token !== null ? { port: connection.port, token: connection.token } : null;
}

async function start(window: string): Promise<PluginRuntime | null> {
  const first = await getPluginHostConnection();
  if (!first.enabled) return null;
  installShared({ react: React, jsxRuntime });
  const registry = createSlots(PLUGIN_SLOTS);
  const loader = createLoader({ registry, base: PLUGIN_BASE });
  let clients: ClientEntry[] = [];
  const sync = () => {
    void loader.sync(clients.filter((entry) => entry.window === window));
  };
  const connection = connectHost<{ clients?: ClientEntry[] }>({
    resolve: target,
    window,
    onSnapshot: (snapshot) => {
      clients = snapshot.clients ?? [];
      sync();
    },
    onEvent: (name, data) => {
      if (name !== "clients") return;
      clients = data as ClientEntry[];
      sync();
    },
  });
  return { registry, loader, connection };
}

export function pluginRuntime(window: string): Promise<PluginRuntime | null> {
  let runtime = runtimes.get(window);
  if (!runtime) {
    runtime = start(window).catch(() => null);
    runtimes.set(window, runtime);
  }
  return runtime;
}
