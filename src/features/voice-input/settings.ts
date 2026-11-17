export type VoiceInputSettings = {
  enabled: boolean;
  shortcut: string;
};

export const DEFAULT_VOICE_SHORTCUT = "Ctrl+Shift+Space";

export const DEFAULT_VOICE_INPUT_SETTINGS: VoiceInputSettings = { enabled: false, shortcut: DEFAULT_VOICE_SHORTCUT };

const MAX_SHORTCUT_LENGTH = 64;

export function normalizeVoiceInputSettings(value: unknown): VoiceInputSettings {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const enabled = typeof saved.enabled === "boolean" ? saved.enabled : DEFAULT_VOICE_INPUT_SETTINGS.enabled;
  const shortcut = typeof saved.shortcut === "string" && saved.shortcut.length <= MAX_SHORTCUT_LENGTH ? saved.shortcut.trim() : DEFAULT_VOICE_SHORTCUT;
  return { enabled, shortcut };
}

export function voiceClock(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function downloadPercent(downloaded: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.floor((downloaded / total) * 100)));
}

export function formatMegabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}

export function appendToNote(note: string, text: string): string {
  const line = text.trim();
  if (!line) return note;
  if (!note.trim()) return line;
  return note.endsWith("\n") ? `${note}${line}` : `${note}\n${line}`;
}

export type VoiceSwitchSeen = {
  stored: boolean;
  switched: boolean;
};

export type VoiceSwitchReconciled = {
  switchTo?: boolean;
  mirror?: boolean;
  migrated: boolean;
  seen: VoiceSwitchSeen;
};

export function withVoicePluginSwitch(settings: VoiceInputSettings, pluginEnabled: boolean | undefined): VoiceInputSettings {
  if (pluginEnabled === undefined || settings.enabled === pluginEnabled) return settings;
  return { ...settings, enabled: pluginEnabled };
}

export function reconcileVoiceSwitch(
  storedEnabled: boolean,
  pluginEnabled: boolean | undefined,
  seen: VoiceSwitchSeen | null,
  alreadyMigrated: boolean,
): VoiceSwitchReconciled | null {
  if (pluginEnabled === undefined) return null;
  const nextSeen: VoiceSwitchSeen = { stored: storedEnabled, switched: pluginEnabled };
  if (!alreadyMigrated) {
    if (!storedEnabled && pluginEnabled) return { switchTo: false, migrated: true, seen: nextSeen };
    if (storedEnabled !== pluginEnabled) return { mirror: pluginEnabled, migrated: true, seen: nextSeen };
    return { migrated: true, seen: nextSeen };
  }
  if (storedEnabled === pluginEnabled) return { migrated: false, seen: nextSeen };
  if (seen && storedEnabled !== seen.stored) return { switchTo: storedEnabled, migrated: false, seen: nextSeen };
  return { mirror: pluginEnabled, migrated: false, seen: nextSeen };
}
