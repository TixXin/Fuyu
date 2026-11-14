import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type PluginDevPlugin = { id: string; path: string };

export type PluginDevState = { enabled: boolean; plugins: PluginDevPlugin[]; recent?: PluginDevPlugin[]; restores?: boolean };

export type PluginTraceEntry = { at: number; outgoing: boolean; text: string };

export const PLUGIN_EVENT_NAMES = [
  "todos.changed",
  "note.changed",
  "agentStatus.changed",
  "island.expanded",
  "island.collapsed",
  "app.locale.changed",
  "clipboard.changed",
  "messages.received",
  "media.changed",
  "shelf.changed",
  "system.locked",
  "system.unlocked",
  "system.suspended",
  "system.resumed",
  "system.idle",
  "system.active",
] as const;

export const getPluginDevState = () => invoke<PluginDevState>("get_plugin_dev_state");

export const setPluginDevMode = (enabled: boolean) => invoke<PluginDevState>("set_plugin_dev_mode", { enabled });

export const loadDevPlugin = (path: string) => invoke<PluginDevState>("load_dev_plugin", { path });

export const reloadDevPlugin = (id: string) => invoke<PluginDevState>("reload_dev_plugin", { id });

export const unloadDevPlugin = (id: string) => invoke<PluginDevState>("unload_dev_plugin", { id });

export const pickPluginFolder = async (title: string) => {
  const picked = await open({ directory: true, multiple: false, title });
  return typeof picked === "string" ? picked : null;
};

export const forgetDevPlugin = (path: string) => invoke<PluginDevState>("forget_dev_plugin", { path });

export const getPluginRpcTrace = (id: string) => invoke<PluginTraceEntry[]>("get_plugin_rpc_trace", { id });

export const sendPluginDevEvent = (id: string, name: string, payload: unknown) =>
  invoke<void>("send_plugin_dev_event", { id, name, payload });
