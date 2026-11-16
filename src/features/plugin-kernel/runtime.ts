import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import type { ClientEntry, ClientLoader, HostConnection as Connection, PluginMessage, ServiceEventMessage } from "@fuyu/plugin-base/client";
import type { ServiceEntry } from "@fuyu/plugin-base/services";
import { installShared } from "@fuyu/plugin-base/client/react";
import type { SlotRegistry } from "@fuyu/plugin-base/client/slots";
import { isMacOS } from "../../lib/platform";
import { getPluginHostConnection } from "./api";
import { windowServices } from "./services.ts";
import { windowSlots, type SlotWindow } from "./slots";

export interface PluginRuntime {
  registry: SlotRegistry;
  loader: ClientLoader;
  connection: Connection;
}

const PLUGIN_BASE = isMacOS ? "fuyu-plugin://localhost" : "http://fuyu-plugin.localhost";
const runtimes = new Map<SlotWindow, Promise<PluginRuntime | null>>();

async function target() {
  const connection = await getPluginHostConnection();
  return connection.port !== null && connection.token !== null ? { port: connection.port, token: connection.token } : null;
}

async function start(window: SlotWindow): Promise<PluginRuntime | null> {
  const first = await getPluginHostConnection();
  if (!first.enabled) return null;
  const { connectHost, createBridge, createLoader, createServiceProxy, HostCallError } = await import("@fuyu/plugin-base/client");
  installShared({ react: React, jsxRuntime });
  const registry = windowSlots(window);
  let connection: Connection | null = null;
  const bridge = createBridge((method, params) => connection?.call(method, params) ?? Promise.reject(new Error("the plugin host is not connected")));
  const loader = createLoader({ registry, base: PLUGIN_BASE, bridge });
  const services = createServiceProxy((method, params, options) => connection?.call(method, params, options) ?? Promise.reject(new HostCallError("peer-gone", "the plugin host is not connected")));
  windowServices.attach(services);
  let clients: ClientEntry[] = [];
  const sync = () => {
    void loader.sync(clients.filter((entry) => entry.window === window));
  };
  connection = connectHost<{ clients?: ClientEntry[]; services?: ServiceEntry[] }>({
    resolve: target,
    window,
    onSnapshot: (snapshot, { fresh }) => {
      clients = snapshot.clients ?? [];
      services.update(snapshot.services ?? []);
      if (fresh) void services.resubscribe();
      sync();
    },
    onEvent: (name, data) => {
      if (name === "plugin") bridge.deliver(data as PluginMessage);
      if (name === "service") services.deliver(data as ServiceEventMessage);
      if (name === "services") services.update(data as ServiceEntry[]);
      if (name !== "clients") return;
      clients = data as ClientEntry[];
      sync();
    },
  });
  return { registry, loader, connection };
}

export function pluginRuntime(window: SlotWindow): Promise<PluginRuntime | null> {
  let runtime = runtimes.get(window);
  if (!runtime) {
    runtime = start(window).catch(() => null);
    runtimes.set(window, runtime);
  }
  return runtime;
}
