import type { BuiltinPluginName } from "../../i18n/sections/settings/pluginsV3";
import type { SettingsCategory } from "./categories";
import type { PluginStatusV3 } from "./usePluginHostStatus";

export const BUILTIN_PAGES: Record<BuiltinPluginName, SettingsCategory> = {
  todos: "todos", calendar: "calendar", music: "music", clipboard: "clipboard", screenshot: "screenshot",
  "file-shelf": "shelf", translation: "translation", "voice-input": "voiceInput", timer: "timerAlerts", messages: "messages",
  agents: "agents", "session-ring": "agentRings", "claude-usage": "agentRings", "cc-connect": "agentPush",
  "ssh-tunnel": "agentRemote", "local-api": "generalApi", "center-pattern": "appearanceCollapsed",
  "device-events": "behaviorAlerts", "system-levels": "behaviorAlerts", "device-use": "behaviorAlerts",
  "theme-market": "theme", updater: "about",
};

export function milliseconds(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 2 : ms < 100 ? 1 : 0)} ms`;
}

export function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isExternalPlugin(plugin: PluginStatusV3, builtinIds: ReadonlySet<string>): boolean {
  return !builtinIds.has(plugin.id) && plugin.kind !== "builtin" && plugin.kind !== "essential";
}
