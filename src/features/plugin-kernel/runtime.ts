import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import type { ClientEntry, ClientLoader, HostConnection as Connection, PluginMessage, ServiceEventMessage } from "@fuyu/plugin-base/client";
import type { ServiceEntry } from "@fuyu/plugin-base/services";
import { installShared } from "@fuyu/plugin-base/client/react";
import type { SlotRegistry } from "@fuyu/plugin-base/client/slots";
import { FALLBACK_LOCALE, getLoadedI18n, loadLocale } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { islandNoticesV1 } from "../../lib/island-notices/service";
import { getPluginHostConnection } from "./api";
import { updatePluginNames, type PluginNameInput } from "./pluginNames.ts";
import { openPluginSettings } from "./settingsOpener.ts";
import { windowServices } from "./services.ts";
import { windowSlots, type SlotWindow } from "./slots";
import { createWaitingMonitor, type WaitingPluginInput } from "./waitingMonitor.ts";

export interface PluginRuntime {
  registry: SlotRegistry;
  loader: ClientLoader;
  connection: Connection;
}

const PLUGIN_BASE = isMacOS ? "fuyu-plugin://localhost" : "http://fuyu-plugin.localhost";
const runtimes = new Map<SlotWindow, Promise<PluginRuntime | null>>();

function waitingText() {
  return (getLoadedI18n(loadLocale()) ?? getLoadedI18n(FALLBACK_LOCALE))?.island.pluginWaiting ?? null;
}

async function target() {
  const connection = await getPluginHostConnection();
  return connection.port !== null && connection.token !== null ? { port: connection.port, token: connection.token } : null;
}

function openFromHost(data: unknown) {
  const plugin = (data as { plugin?: unknown } | null)?.plugin;
  if (typeof plugin !== "string" || plugin === "") return;
  void openPluginSettings(plugin).catch((error: unknown) => console.error(`Failed to open the settings of ${plugin}`, error));
}

async function start(window: SlotWindow): Promise<PluginRuntime | null> {
  const first = await getPluginHostConnection();
  if (!first.enabled) return null;
  const { connectHost, createBridge, createLoader, createServiceProxy, HostCallError } = await import("@fuyu/plugin-base/client");
  installShared({ react: React, jsxRuntime });
  const registry = windowSlots(window);
  let connection: Connection | null = null;
  const bridge = createBridge((method, params) => connection?.call(method, params) ?? Promise.reject(new Error("the plugin host is not connected")));
  const loader = createLoader({ registry, base: PLUGIN_BASE, bridge, openSettings: openPluginSettings });
  const services = createServiceProxy((method, params, options) => connection?.call(method, params, options) ?? Promise.reject(new HostCallError("peer-gone", "the plugin host is not connected")));
  windowServices.attach(services);
  const waitingMonitor = window === "island"
    ? createWaitingMonitor({
        onOverdue: ({ id, waitingFor }) => {
          const text = waitingText();
          if (!text) return;
          void windowServices
            .get(islandNoticesV1)
            .notify({
              pluginId: id,
              pluginName: null,
              title: text.title(id),
              body: text.body(waitingFor.join(", ")),
              durationMs: 6000,
              actions: [],
            })
            .catch(() => undefined);
        },
      })
    : null;
  let clients: ClientEntry[] = [];
  const sync = () => {
    void loader.sync(clients.filter((entry) => entry.window === window));
  };
  connection = connectHost<{ clients?: ClientEntry[]; services?: ServiceEntry[]; plugins?: WaitingPluginInput[] }>({
    resolve: target,
    window,
    onSnapshot: (snapshot, { fresh }) => {
      clients = snapshot.clients ?? [];
      services.update(snapshot.services ?? []);
      if (snapshot.plugins) {
        waitingMonitor?.update(snapshot.plugins);
        updatePluginNames(snapshot.plugins);
      }
      if (fresh) void services.resubscribe();
      sync();
    },
    onEvent: (name, data) => {
      if (name === "plugin") bridge.deliver(data as PluginMessage);
      if (name === "service") services.deliver(data as ServiceEventMessage);
      if (name === "services") services.update(data as ServiceEntry[]);
      if (name === "settings.open" && window === "island") openFromHost(data);
      if (name === "plugins" && Array.isArray(data)) {
        waitingMonitor?.update(data as WaitingPluginInput[]);
        updatePluginNames(data as PluginNameInput[]);
      }
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
