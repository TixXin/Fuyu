import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import catalog from "../../src/features/builtins.json";
import { BUILTIN_PLUGINS_CHANGED, type BuiltinPlugin } from "../../src/features/plugin-kernel/api";
import { installIpcLedger, type IpcInternals } from "../../src/features/plugin-kernel/ipcLedger";

export const FAKE = "lab.leaky";
export const BUILTINS = catalog.plugins.map(({ id, kind, root }) => ({ id, root, essential: kind === "essential" }));

let off = new Set<string>();
let withFake = false;
let revision = 0;

export function switchList(): BuiltinPlugin[] {
  const ids = [...BUILTINS.map((plugin) => plugin.id), ...(withFake ? [FAKE] : [])];
  return ids.map((id) => ({ id, kind: id === "updater" ? "essential" : "builtin", enabled: !off.has(id), background: [] }));
}

export async function switchOff(ids: readonly string[], fake = false) {
  off = new Set(ids);
  withFake = fake;
  await emit(BUILTIN_PLUGINS_CHANGED, switchList());
}

const MEDIA = {
  available: false, audioActive: false, audioPeak: 0, playbackStatus: "unavailable", title: null, artist: null, album: null, thumbnail: null,
  positionMs: 0, durationMs: 0, canSeek: false, canNext: false, canPrevious: false, shuffleActive: null, canShuffle: false, repeatMode: "unknown",
  canRepeat: false, volume: -1, sourceApp: null, activeSessionId: null, sessions: [], updatedAt: 0,
};

const PLUGIN_V2_BASE = {
  dev: false, platforms: [], webview: false, notificationsMuted: false, windowRules: {}, keybindingConflicts: [], keybindings: {}, optionalPermissions: [], calls: [], sensitive: {},
  activation: "startup", activationEvents: [], startupMs: null, resources: null, keepAlive: null, revoked: null, updateAvailable: null, autoUpdated: null, updateFailed: null,
  preRelease: false, preReleaseAvailable: null, memoryLimitMb: 512, signingKeyChanged: false, authorKey: null,
};
const PLUGINS_V2 = {
  allowThirdParty: true, nodeAvailable: false, powershellAvailable: true, autoUpdate: false,
  plugins: [{
    ...PLUGIN_V2_BASE, id: "focusd.timer", builtin: true, invalidReason: null, name: { "zh-CN": "计时器", en: "Timer" }, description: { "zh-CN": "计时器", en: "Timer" },
    version: "1.0.0", author: "FocuSD", homepage: "", permissions: [], commands: [], runtime: "builtin", hasProcess: false, enabled: true, needsApproval: false,
    status: "running", error: null, log: [], settingsSchema: [], settings: {}, info: [],
  }],
};

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  switch (command) {
    case "get_builtin_plugins": return switchList();
    case "set_builtin_plugin_enabled":
      if (args.enabled) off.delete(String(args.id));
      else off.add(String(args.id));
      return switchList();
    case "get_plugin_host_connection": return { enabled: false, port: null, token: null, generation: null, safeMode: null };
    case "get_launch_at_startup": return false;
    case "get_default_todo_save_directory": return "";
    case "get_data_home": return { home: "C:\\Users\\demo\\.fuyu", defaultHome: "C:\\Users\\demo\\.fuyu", source: "default" };
    case "get_clipboard_history": return { settings: { enabled: true, captureImages: true, maxItems: 100, shortcut: "Ctrl+Shift+V", shortcutEnabled: true }, items: [] };
    case "list_agent_sessions": return [];
    case "list_plugin_views": return { views: [], status: [] };
    case "list_plugins": return PLUGINS_V2;
    case "get_agent_status": return { codex: { phase: "idle", updatedAt: 0 }, claudeCode: { phase: "idle", updatedAt: 0 }, updatedAt: 0, statusPath: "" };
    case "get_media_state": return MEDIA;
    case "get_audio_level": return { active: false, peak: 0, updatedAt: 0 };
    case "get_foreground_fullscreen": return { active: false, onIslandMonitor: false };
    case "set_island_interaction": return "disabled";
    case "set_qq_notifications_enabled": return { revision: ++revision, enabled: args.enabled, status: args.enabled ? "listening" : "disabled", items: [], error: null };
    case "set_wechat_reminders_enabled": return { revision: ++revision, enabled: args.enabled, status: args.enabled ? "listening" : "disabled", pending: false, lastAttentionAt: null, error: null };
    case "get_qq_mail_state": return [];
    case "has_translation_secret": return false;
    case "set_translation_shortcut":
    case "set_translation_selection_shortcut": return args.shortcut;
    case "read_translation_clipboard": return "";
    case "update_backup_list": return { backups: [], brokenFiles: [], pendingRestore: null };
    case "plugin:window|is_visible": return true;
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("main");

export const ledger = installIpcLedger((window as unknown as { __TAURI_INTERNALS__: IpcInternals }).__TAURI_INTERNALS__);
