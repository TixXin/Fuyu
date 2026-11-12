import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

export type ViewLocalizedText = { "zh-CN": string; en: string };

export type PluginViewTemplate = "list" | "detail" | "form" | "status" | "webview";

export type PluginViewRunState = "stopped" | "starting" | "running" | "restarting" | "crashed" | "idle";

export type PluginViewEntry = {
  pluginId: string;
  pluginName: ViewLocalizedText;
  viewId: string;
  title: ViewLocalizedText;
  icon: string;
  template: PluginViewTemplate;
  height?: number;
  width?: number;
  frame?: "card" | "none";
  status: PluginViewRunState;
  error: string | null;
};

export type PluginWebviewBounds = { x: number; y: number; width: number; height: number };

export function showPluginWebview(id: string, viewId: string, bounds: PluginWebviewBounds, locale: string, ink: string | null = null) {
  return invoke<void>("show_plugin_webview", { id, viewId, bounds, locale, ink });
}

export function hidePluginWebview(id: string, viewId: string) {
  return invoke<void>("hide_plugin_webview", { id, viewId });
}

export type PluginStatusTone = "neutral" | "accent" | "warning" | "danger";

export type PluginStatusCell = { label: string; value: string; tone: PluginStatusTone };

export type PluginStatusBattery = { level: number; tone: PluginStatusTone };

export type PluginStatusSlice = { value: number; tone: PluginStatusTone };

export type PluginStatusEntry = {
  pluginId: string;
  itemId: string;
  priority: number;
  text: string;
  tooltip: string | null;
  tone: PluginStatusTone;
  cells?: PluginStatusCell[];
  ring?: number;
  batteries?: PluginStatusBattery[];
  pie?: PluginStatusSlice[];
};

export type PluginStatusItemEntry = { pluginId: string; pluginName: ViewLocalizedText; itemId: string };

export type PluginViewsSnapshot = { views: PluginViewEntry[]; status: PluginStatusEntry[]; statusItems: PluginStatusItemEntry[] };

const PLUGIN_VIEW_CHANGED_EVENT = "plugin-view-changed";
export type PluginViewChanged =
  | { kind: "view"; pluginId: string; viewId: string; model: unknown }
  | { kind: "status"; pluginId: string; itemId: string; status: unknown }
  | { kind: "reset"; pluginId: string; status: PluginViewRunState };

const PLUGIN_OPEN_VIEW_EVENT = "plugin-open-view";
export type PluginOpenView = { pluginId: string; viewId: string };

export function listenPluginOpenView(onOpen: (request: PluginOpenView) => void) {
  return listen<PluginOpenView>(PLUGIN_OPEN_VIEW_EVENT, (event) => onOpen(event.payload));
}

export function listPluginViews() {
  return invoke<PluginViewsSnapshot>("list_plugin_views");
}

export function listenPluginViewChanged(onChange: (change: PluginViewChanged) => void) {
  return listen<PluginViewChanged>(PLUGIN_VIEW_CHANGED_EVENT, (event) => onChange(event.payload));
}

export function setPluginViewVisible(id: string, viewId: string, visible: boolean) {
  return invoke<unknown>("set_plugin_view_visible", { id, viewId, visible });
}

export function runPluginViewAction(id: string, viewId: string, actionId: string, itemId: string | null, checked: boolean | null) {
  return invoke<void>("run_plugin_view_action", { id, viewId, itemId, actionId, checked });
}

export function submitPluginView(id: string, viewId: string, values: Record<string, unknown>) {
  return invoke<void>("submit_plugin_view", { id, viewId, values });
}

export function searchPluginView(id: string, viewId: string, query: string) {
  return invoke<void>("search_plugin_view", { id, viewId, query });
}

export function restartPlugin(id: string) {
  return invoke<void>("restart_plugin", { id });
}

export function openPluginViewLink(url: string) {
  return url.startsWith("https://") ? openUrl(url) : Promise.resolve();
}
