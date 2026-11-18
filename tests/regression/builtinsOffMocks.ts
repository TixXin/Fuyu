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
const configs: Record<string, Record<string, unknown>> = {};

export function switchList(): BuiltinPlugin[] {
  const ids = [...BUILTINS.map((plugin) => plugin.id), ...(withFake ? [FAKE] : [])];
  return ids.map((id) => ({ id, kind: id === "updater" ? "essential" : "builtin", enabled: !off.has(id), background: [], config: { ...(configs[id] ?? {}) } }));
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

const PLUGINS_V2 = { allowThirdParty: true, nodeAvailable: false, powershellAvailable: true, autoUpdate: false, plugins: [] };

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  switch (command) {
    case "get_builtin_plugins": return switchList();
    case "set_builtin_plugin_enabled":
      if (args.enabled) off.delete(String(args.id));
      else off.add(String(args.id));
      return switchList();
    case "set_builtin_plugin_config":
      configs[String(args.id)] = { ...(configs[String(args.id)] ?? {}), [String(args.key)]: args.value };
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
    case "get_qq_notification_state": return { revision: ++revision, enabled: true, status: "listening", items: [], error: null };
    case "get_im_sources_state": return [];
    case "set_wechat_expose_ui": case "set_wechat_hide_taskbar_button": return { revision: ++revision, enabled: true, status: "listening", pending: false, lastAttentionAt: null, error: null };
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
