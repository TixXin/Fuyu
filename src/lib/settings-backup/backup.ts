import { renamedKey } from "../renamedKeys.ts";

export const BACKUP_KEYS = [
  "fuyu-settings",
  "fuyu-setting-presets",
  "fuyu-locale",
  "fuyu-translation-settings",
  "fuyu-music-sources",
  "fuyu-qq-notifications-enabled",
  "fuyu-wechat-reminders-enabled",
  "fuyu-wechat-expose-ui",
  "fuyu-wechat-hide-taskbar-button",
  "fuyu-qq-mail-settings",
  "fuyu-qq-mail-remote-images",
  "fuyu-collapsed-items",
  "fuyu-screenshot-annotation",
  "fuyu-screenshot-settings",
  "fuyu-save-directory",
  "fuyu-update-channel",
  "fuyu-update-preferences",
  "fuyu-agent-sounds",
  "fuyu-agent-session-filters",
  "fuyu-agent-approval",
  "fuyu-agent-push",
  "fuyu-lyrics-offsets",
  "fuyu-tray-menu-layout",
  "fuyu-voice-input",
  "fuyu-todo-prefs",
  "fuyu-calendar-prefs",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

const APP_NAMES = ["fuyu", "fly-island"];

export const SETTINGS_SWITCH_PLUGINS = {
  todoEnabled: "todos",
  translationEnabled: "translation",
  calendarEnabled: "calendar",
  shelfEnabled: "file-shelf",
  screenshotEnabled: "screenshot",
  musicEnabled: "music",
  agentStatusEnabled: "agents",
  deviceAlerts: "device-events",
  levelPopup: "system-levels",
  deviceUseIndicator: "device-use",
} as const;

export type SettingsSwitchField = keyof typeof SETTINGS_SWITCH_PLUGINS;

const SETTINGS_SWITCH_ENTRIES = Object.entries(SETTINGS_SWITCH_PLUGINS) as [SettingsSwitchField, string][];

export type BuiltinSwitchSnapshot = {
  enabled: Readonly<Record<string, boolean>>;
  config: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

export type RestoredSwitches = {
  plugins: [string, boolean][];
  configs: [string, string, boolean][];
  migrated: string[];
};

export type SettingsBackup = {
  app: "fuyu";
  version: 1;
  exportedAt: string;
  keys: Partial<Record<BackupKey, string>>;
};

export type BackupProblem = "notJson" | "notBackup" | "newerVersion" | "empty";

export function isBackupKey(key: string): key is BackupKey {
  return (BACKUP_KEYS as readonly string[]).includes(key);
}

function parseJsonObject(text: string | undefined): Record<string, unknown> | null {
  if (typeof text !== "string") return null;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : null;
  } catch {
    return null;
  }
}

export function withSwitchSnapshot(keys: Partial<Record<BackupKey, string>>, snapshot: BuiltinSwitchSnapshot | null): Partial<Record<BackupKey, string>> {
  if (!snapshot) return keys;
  const next: Partial<Record<BackupKey, string>> = { ...keys };
  const hasStoredKeys = Object.keys(keys).length > 0;
  const existingSettings = parseJsonObject(next["fuyu-settings"]);
  const settings = existingSettings ?? {};
  let settingsChanged = false;
  let nonDefaultSettingsSwitch = false;
  for (const [field, id] of SETTINGS_SWITCH_ENTRIES) {
    const on = snapshot.enabled[id];
    if (typeof on !== "boolean") continue;
    const defaultOn = id !== "screenshot";
    if (on !== defaultOn) nonDefaultSettingsSwitch = true;
    if (settings[field] !== on) {
      settings[field] = on;
      settingsChanged = true;
    }
  }
  const mail = snapshot.config.messages?.mail;
  if (typeof mail === "boolean") {
    if (!mail) nonDefaultSettingsSwitch = true;
    if (settings.mailEnabled !== mail) {
      settings.mailEnabled = mail;
      settingsChanged = true;
    }
  }
  if ((existingSettings && settingsChanged) || (!existingSettings && (nonDefaultSettingsSwitch || (hasStoredKeys && settingsChanged)))) {
    next["fuyu-settings"] = JSON.stringify(settings);
  }
  const qq = snapshot.config.messages?.qq;
  if (typeof qq === "boolean" && (hasStoredKeys || !qq || next["fuyu-qq-notifications-enabled"] !== undefined)) {
    next["fuyu-qq-notifications-enabled"] = String(qq);
  }
  const wechat = snapshot.config.messages?.wechat;
  if (typeof wechat === "boolean" && (hasStoredKeys || !wechat || next["fuyu-wechat-reminders-enabled"] !== undefined)) {
    next["fuyu-wechat-reminders-enabled"] = String(wechat);
  }
  const voiceOn = snapshot.enabled["voice-input"];
  if (typeof voiceOn === "boolean") {
    const voice = parseJsonObject(next["fuyu-voice-input"]);
    if (voice && voice.enabled !== voiceOn) next["fuyu-voice-input"] = JSON.stringify({ ...voice, enabled: voiceOn });
    else if (!voice && (voiceOn || hasStoredKeys)) next["fuyu-voice-input"] = JSON.stringify({ enabled: voiceOn, shortcut: "Ctrl+Shift+Space" });
  }
  return next;
}

export function switchesFromBackup(keys: Partial<Record<BackupKey, string>>): RestoredSwitches {
  const plugins: [string, boolean][] = [];
  const configs: [string, string, boolean][] = [];
  const migrated: string[] = [];
  const settings = parseJsonObject(keys["fuyu-settings"]);
  if (settings) {
    for (const [field, id] of SETTINGS_SWITCH_ENTRIES) {
      if (typeof settings[field] === "boolean") {
        plugins.push([id, settings[field] as boolean]);
        migrated.push(field);
      }
    }
    if (typeof settings.mailEnabled === "boolean") configs.push(["messages", "mail", settings.mailEnabled]);
  }
  if (typeof keys["fuyu-qq-notifications-enabled"] === "string") {
    configs.push(["messages", "qq", keys["fuyu-qq-notifications-enabled"] !== "false"]);
  }
  if (typeof keys["fuyu-wechat-reminders-enabled"] === "string") {
    configs.push(["messages", "wechat", keys["fuyu-wechat-reminders-enabled"] !== "false"]);
  }
  const voice = parseJsonObject(keys["fuyu-voice-input"]);
  if (voice && typeof voice.enabled === "boolean") {
    plugins.push(["voice-input", voice.enabled]);
    migrated.push("fuyu-voice-input");
  }
  return { plugins, configs, migrated };
}

export function buildBackup(
  read: (key: BackupKey) => string | null,
  now: Date,
  snapshot: BuiltinSwitchSnapshot | null = null,
): SettingsBackup {
  const keys: SettingsBackup["keys"] = {};
  for (const key of BACKUP_KEYS) {
    const value = read(key);
    if (value !== null) keys[key] = value;
  }
  return { app: "fuyu", version: 1, exportedAt: now.toISOString(), keys: withSwitchSnapshot(keys, snapshot) };
}

export function backupFileName(now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `fuyu-settings-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export function parseBackup(text: string): { keys: Partial<Record<BackupKey, string>> } | { problem: BackupProblem } {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return { problem: "notJson" };
  }
  if (typeof value !== "object" || value === null) return { problem: "notBackup" };
  const backup = value as Record<string, unknown>;
  if (typeof backup.app !== "string" || !APP_NAMES.includes(backup.app) || typeof backup.keys !== "object" || backup.keys === null) {
    return { problem: "notBackup" };
  }
  if (typeof backup.version !== "number" || backup.version > 1) return { problem: "newerVersion" };
  const keys: Partial<Record<BackupKey, string>> = {};
  for (const [stored, value] of Object.entries(backup.keys)) {
    const key = renamedKey(stored) ?? stored;
    if (isBackupKey(key) && typeof value === "string" && !(key in keys && stored !== key)) keys[key] = value;
  }
  return Object.keys(keys).length > 0 ? { keys } : { problem: "empty" };
}
