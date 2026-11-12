import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { PluginSensitiveChoice, PromptedPermission } from "./promptedPermissions";

export const PLUGIN_PERMISSIONS = [
  "todos:read",
  "todos:write",
  "notes:read",
  "notes:write",
  "agent-status:read",
  "agent-status:write",
  "island:notify",
  "secrets",
  "clipboard:read",
  "messages:read",
  "media:read",
  "media:control",
  "shelf:read",
  "shelf:write",
] as const;
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export type LocalizedText = { "zh-CN": string; en: string };
export type PluginCommand = {
  id: string;
  title: LocalizedText;
  keybinding?: string;
  when?: string;
};

export type PluginRuntimeRequirement = "exe" | "powershell" | "node" | "none" | "builtin";

export type PluginStatus = "stopped" | "starting" | "running" | "restarting" | "crashed" | "idle";

export type PluginProcess = { name: string; memoryBytes: number; workingSetBytes: number };
export type PluginResources = {
  memoryBytes: number;
  runtimeBytes: number | null;
  processes: PluginProcess[];
  cpuPercent: number;
  highCpu: boolean;
};

export type PluginSettingSpec = {
  key: string;
  type: "boolean" | "string" | "number" | "select";
  title: LocalizedText;
  description?: LocalizedText;
  default?: unknown;
  options?: { value: string; title: LocalizedText }[];
  min?: number;
  max?: number;
};

export type PluginInfoItem = {
  label: LocalizedText;
  value: string;
  copy: boolean;
  secret: boolean;
};

export type PluginCallRecord = {
  method: string;
  outcome: "ok" | "denied" | "unknown" | "error";
  status: number | null;
  count: number;
  at: number;
};

export type PluginInfo = {
  id: string;
  builtin: boolean;
  dev: boolean;
  invalidReason: string | null;
  name: LocalizedText | null;
  description: LocalizedText | null;
  version: string;
  author: string;
  homepage: string;
  permissions: string[];
  optionalPermissions: string[];
  calls: PluginCallRecord[];
  commands: PluginCommand[];
  runtime: PluginRuntimeRequirement;
  hasProcess: boolean;
  enabled: boolean;
  needsApproval: boolean;
  status: PluginStatus;
  error: string | null;
  log: string[];
  settingsSchema: PluginSettingSpec[];
  settings: Record<string, unknown>;
  info: PluginInfoItem[];
  notificationsMuted: boolean;
  keybindingConflicts: string[];
  keybindings: Record<string, string>;
  sensitive: Partial<Record<PromptedPermission, PluginSensitiveChoice>>;
  activation: "startup" | "onDemand";
  activationEvents: string[];
  startupMs: number | null;
  resources: PluginResources | null;
  keepAlive: string | null;
  revoked: LocalizedText | null;
  updateAvailable: string | null;
  signingKeyChanged: boolean;
  authorKey: string | null;
  autoUpdated: string | null;
  preRelease: boolean;
  preReleaseAvailable: string | null;
  memoryLimitMb: number;
};

export type PluginsSnapshot = {
  allowThirdParty: boolean;
  nodeAvailable: boolean;
  pluginsDir: string;
  plugins: PluginInfo[];
  autoUpdate: boolean;
  trustedPublishers: string[];
};

export const MARKET_CATEGORIES = ["productivity", "todos", "developer", "media", "messages", "information", "utilities", "sounds"] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export type MarketPlugin = {
  id: string;
  name: LocalizedText;
  description: LocalizedText | null;
  version: string;
  apiVersion: number;
  minAppVersion: string | null;
  author: string;
  homepage: string;
  permissions: string[];
  optionalPermissions?: string[];
  runtime: PluginRuntimeRequirement | null;
  download: { url: string; sha256: string; size: number };
  publisher: string | null;
  repo: string | null;
  categories: string[];
  webview?: boolean;
  readme?: string;
  changelog?: string;
  installedVersion: string | null;
  incompatible: string | null;
  revoked: LocalizedText | null;
  authorSignature?: { keyId: string; signature: string };
  authorKeys?: { keyId: string; publicKey: string }[];
  signedBy: string | null;
  verified?: { via: "github" } | { via: "domain"; domain: string };
  signingKeyChanged: boolean;
};

export type MarketSnapshot = {
  indexUrl: string;
  nodeAvailable: boolean;
  plugins: MarketPlugin[];
  trustedPublishers: string[];
  officialPublisher: string;
};

export const marketPublisher = (plugin: MarketPlugin, market: MarketSnapshot) => plugin.publisher || market.officialPublisher;

export function setPluginAutoUpdate(enabled: boolean) {
  return invoke<PluginsSnapshot>("set_plugin_auto_update", { enabled });
}

export function setPluginPublisherTrusted(publisher: string, trusted: boolean) {
  return invoke<PluginsSnapshot>("set_plugin_publisher_trusted", { publisher, trusted });
}

export function checkPluginUpdates() {
  return invoke<PluginsSnapshot>("check_plugin_updates");
}

export function getPluginMarket() {
  return invoke<MarketSnapshot>("get_plugin_market");
}

export function getCachedPluginMarket() {
  return invoke<MarketSnapshot | null>("get_cached_plugin_market");
}

export function installMarketPlugin(id: string, acceptKeyChange = false) {
  return invoke<PluginsSnapshot>("install_market_plugin", { id, acceptKeyChange });
}

export function uninstallPlugin(id: string) {
  return invoke<PluginsSnapshot>("uninstall_plugin", { id });
}

export function listPlugins() {
  return invoke<PluginsSnapshot>("list_plugins");
}

export function setPluginsAllowed(allowed: boolean) {
  return invoke<PluginsSnapshot>("set_plugins_allowed", { allowed });
}

export function setPluginEnabled(id: string, enabled: boolean) {
  return invoke<PluginsSnapshot>("set_plugin_enabled", { id, enabled });
}

export function reloadPlugins() {
  return invoke<PluginsSnapshot>("reload_plugins");
}

export function openPluginsFolder() {
  return invoke<void>("open_plugins_folder");
}

export const NODE_DOWNLOAD_URL = { "zh-CN": "https://nodejs.org/zh-cn/download", en: "https://nodejs.org/en/download" } as const;

export function openPluginHomepage(url: string) {
  return url.startsWith("https://") ? openUrl(url) : Promise.resolve();
}

export function setPluginSetting(id: string, key: string, value: unknown) {
  return invoke<PluginsSnapshot>("set_plugin_setting", { id, key, value });
}

export function runPluginCommand(id: string, command: string) {
  return invoke<void>("run_plugin_command", { id, command });
}

const PLUGIN_HOST_EVENT = "plugin-host-event";
export type PluginHostEventName =
  | "todos.changed"
  | "note.changed"
  | "agentStatus.changed"
  | "island.expanded"
  | "island.collapsed"
  | "app.locale.changed";

export function emitPluginHostEvent(name: PluginHostEventName, payload: Record<string, unknown>) {
  return emit(PLUGIN_HOST_EVENT, { name, payload });
}

const PLUGIN_NOTIFICATION_EVENT = "plugin-notification";
export type PluginNotification = {
  pluginId: string;
  pluginName: LocalizedText | null;
  title: string;
  body: string;
  durationMs: number;
  actions: { id: string; title: string }[];
  icon?: "plugin" | "media"; layout?: "card" | "inline"; controls?: "none" | "media"; iconUrl?: string | null;
};

export function listenPluginNotifications(onNotification: (notification: PluginNotification) => void) {
  return listen<PluginNotification>(PLUGIN_NOTIFICATION_EVENT, (event) => onNotification(event.payload));
}

export const TODO_CONTEXT_MENU = "todo/context";
export const ITEM_CONTEXT_MENUS = ["clipboard/context", "shelf/context", "message/context"] as const;
export type PluginItemMenu = (typeof ITEM_CONTEXT_MENUS)[number];
export type PluginMenu = typeof TODO_CONTEXT_MENU | PluginItemMenu;
export type PluginMenuEntry = { pluginId: string; pluginName: LocalizedText; command: string; title: LocalizedText };

export function listPluginMenu(menu: PluginMenu) {
  return invoke<PluginMenuEntry[]>("list_plugin_menu", { menu });
}

export function runPluginMenuCommand(id: string, menu: typeof TODO_CONTEXT_MENU, command: string, todoId: string) {
  return invoke<void>("run_plugin_menu_command", { id, menu, command, todoId });
}

export function runPluginItemMenuCommand(id: string, menu: PluginItemMenu, command: string, itemId: string) {
  return invoke<void>("run_plugin_item_menu_command", { id, menu, command, itemId });
}

const PLUGIN_KEYBINDING_EVENT = "plugin-keybinding";
export type PluginKeybindingPress = { pluginId: string; command: string; when: string | null };

export function listenPluginKeybindings(onPress: (press: PluginKeybindingPress) => void) {
  return listen<PluginKeybindingPress>(PLUGIN_KEYBINDING_EVENT, (event) => onPress(event.payload));
}

const PLUGIN_PERMISSION_REQUEST_EVENT = "plugin-permission-request";
export type PluginPermissionRequest = {
  requestId: number;
  pluginId: string;
  pluginName: LocalizedText | null;
  permission: PromptedPermission;
  timeoutMs: number;
};
export type PluginPermissionAnswer = "allow" | "deny" | "once";

export function listenPluginPermissionRequests(onRequest: (request: PluginPermissionRequest) => void) {
  return listen<PluginPermissionRequest>(PLUGIN_PERMISSION_REQUEST_EVENT, (event) => onRequest(event.payload));
}

export function answerPluginPermission(requestId: number, answer: PluginPermissionAnswer) {
  return invoke<void>("answer_plugin_permission", { requestId, answer });
}

export function revokePluginSensitivePermission(id: string, permission: PromptedPermission) {
  return invoke<PluginsSnapshot>("revoke_plugin_sensitive_permission", { id, permission });
}

export function runPluginNotificationAction(id: string, action: string) {
  return invoke<void>("run_plugin_notification_action", { id, action });
}

export const PLUGIN_MEMORY_LIMITS_MB = [256, 512, 1024, 2048] as const;

export function setPluginMemoryLimit(id: string, megabytes: number) {
  return invoke<PluginsSnapshot>("set_plugin_memory_limit", { id, megabytes });
}

export function setPluginKeybinding(id: string, command: string, keybinding: string | null) {
  return invoke<PluginsSnapshot>("set_plugin_keybinding", { id, command, keybinding });
}

export function setPluginPreRelease(id: string, enabled: boolean) {
  return invoke<PluginsSnapshot>("set_plugin_pre_release", { id, enabled });
}

export function setPluginNotificationsMuted(id: string, muted: boolean) {
  return invoke<PluginsSnapshot>("set_plugin_notifications_muted", { id, muted });
}

export function clearPluginData(id: string) {
  return invoke<PluginsSnapshot>("clear_plugin_data", { id });
}
