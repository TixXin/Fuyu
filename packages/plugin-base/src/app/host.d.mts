import type { HostExtension } from "../host/index.mjs";

export interface PluginSetup {
  hint: string | { "zh-CN"?: string; en?: string } | null;
}

export interface AppPluginStatus {
  setup?: PluginSetup;
}

export interface SettingsOpener {
  attachWindows(windows: { connected(): string[]; publish(name: string, data: unknown): void }): () => void;
  open(plugin: string): Promise<void>;
  setup(plugin: string, state: { needed?: unknown; hint?: unknown } | null | undefined): void;
  setupOf(plugin: string): PluginSetup | null;
  forget(plugin: string): void;
  watch(listener: () => void): () => void;
}

export interface IslandControlHub {
  attachWindows(windows: { connected(): string[]; publish(name: string, data: unknown): void }): () => void;
  request(action: "open" | "collapse", plugin: string, page?: string | null): Promise<unknown>;
  notify(notice: { pluginId: string } & Record<string, unknown>): Promise<boolean>;
  settle(params: { id?: unknown; value?: unknown; error?: { code?: unknown; message?: unknown } | null } | null | undefined, window: string): boolean;
  onNoticeAction(listener: (data: { pluginId: string; action: string }) => void): () => void;
  noticeAction(params: unknown, window: string): boolean;
  timeoutMs: number;
  noticeTimeoutMs: number;
}

export interface AppHost {
  settingsOpener: SettingsOpener;
  islandControl: IslandControlHub;
}

export declare const APP_HOST_EXTENSIONS: readonly HostExtension[];
export const SETTINGS_OPEN_EVENT: "settings.open";
export const SETTINGS_OPENER_WINDOW: "island";
export const SETUP_HINT_MAX: number;
export function setupHint(hint: unknown): PluginSetup["hint"];
export const ISLAND_REQUEST_EVENT: "island.request";
export const ISLAND_WINDOW: "island";
export const ISLAND_TIMEOUT_MS: number;
export const ISLAND_NOTICE_TIMEOUT_MS: number;
