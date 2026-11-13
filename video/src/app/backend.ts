import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { TodosChange, TodosData } from "../../../src/features/todos/api";
import packageJson from "../../../package.json";
import type { World } from "./world";

type Args = Record<string, unknown>;

function applyTodos(world: World, change: TodosChange) {
  const { baseRevision: _ignored, ...fields } = change;
  world.todos = { ...world.todos, ...fields } as TodosData;
  world.todosRevision += 1;
  return { revision: world.todosRevision, conflicts: [], data: null };
}

function clipboard(world: World) {
  return {
    settings: {
      enabled: true, captureImages: true, maxItems: 200, shortcut: "Ctrl+Shift+V", shortcutEnabled: true,
      openIn: "island", popupPosition: "cursor", autoPaste: true, terminalImagePath: false, retentionDays: 0,
      skipSensitive: true, winV: false, secrets: "mask", excludedApps: [], captureFiles: true, captureHtml: true, ocr: true,
    },
    items: world.clipboard,
  };
}

function handlers(world: World): Record<string, (args: Args) => unknown> {
  const now = () => Date.now();
  return {
    "plugin:app|version": () => packageJson.version,
    updater_configured: () => false,
    read_settings_file: () => null,
    get_island_top_attachment: () => true,
    get_foreground_fullscreen: () => ({ active: false, onIslandMonitor: false }),
    get_device_use: () => ({ camera: [], microphone: [] }),
    migrate_todos: () => ({ revision: world.todosRevision, data: world.todos, notice: null }),
    get_todos_state: () => ({ revision: world.todosRevision, data: world.todos, notice: null }),
    apply_todos_change: (args) => applyTodos(world, args.change as TodosChange),
    save_todo_markdown: (args) => ({ filePath: `${String(args.directory)}\\${String(args.date)}.md` }),
    get_legacy_todo_save_directory: () => "",
    get_default_todo_save_directory: () => "C:\\Users\\fuyu\\Documents\\Fuyu",
    list_plugin_views: () => ({ views: [], status: [], statusItems: [] }),
    list_plugin_menu: () => [],
    list_plugins: () => ({ allowThirdParty: false, nodeAvailable: true, pluginsDir: "", plugins: [], autoUpdate: false, trustedPublishers: [] }),
    get_media_state: () => {
      const { media } = world;
      if (media.playbackStatus !== "playing") return media;
      return { ...media, audioPeak: world.audioPeak(), positionMs: media.positionMs + (now() - media.updatedAt), updatedAt: now() };
    },
    media_play_pause: () => world.media,
    get_audio_level: () => ({ active: world.media.audioActive, peak: world.media.audioActive ? world.audioPeak() : 0, updatedAt: now() }),
    get_lyrics: (args) => world.lyrics[String((args.query as Args).title)] ?? null,
    get_agent_status: () => world.agentStatus,
    list_agent_sessions: () => world.sessions,
    list_agent_effort_labels: () => ({}),
    get_agent_host_icon: () => null,
    get_agent_usage: () => world.usage,
    get_codex_usage: () => null,
    agent_approval_pending: () => world.approvals,
    agent_approval_decide: (args) => {
      world.approvals = world.approvals.filter((request) => request.id !== args.id);
      void emit("agent-approval-closed", { id: args.id, reason: "decided" });
      return null;
    },
    agent_sessions_in_front: () => [],
    focus_agent_window: () => true,
    get_clipboard_history: () => clipboard(world),
    copy_clipboard_history_item: () => clipboard(world),
    get_clipboard_link_preview: () => ({ title: null, icon: null }),
    get_calendar_events: () => ({ events: world.calendar, problems: [], fetchedAt: now(), fromMs: now() - 86_400_000, toMs: now() + 172_800_000, sourceCount: world.calendar.length > 0 ? 1 : 0 }),
    set_qq_notifications_enabled: () => world.qq,
    request_qq_notification_access: () => "allowed",
    set_wechat_reminders_enabled: () => world.wechat,
    get_qq_mail_state: () => [world.mail],
    read_qq_mail: (args) => world.mailBodies[String(args.messageId)] ?? { id: args.messageId, content: "", contentType: "text/plain", attachments: [] },
    mark_qq_mail_read: () => world.mail,
    refresh_qq_mail: () => world.mail,
    has_translation_secret: () => true,
    read_translation_clipboard: () => null,
    translate_text: (args) => new Promise((resolve) => {
      window.setTimeout(() => resolve(world.translations[String(args.text).trim()] ?? ""), 520);
    }),
    island_is_foreground: () => true,
    release_island_hover_focus: () => true,
  };
}

export function installBackend(world: World) {
  Object.assign(globalThis, { isTauri: true });
  mockWindows("main");
  const table = handlers(world);
  mockIPC((command, payload) => {
    const args = (payload ?? {}) as Args;
    world.calls.push({ command, args });
    return table[command]?.(args) ?? null;
  }, { shouldMockEvents: true });
  return { emit: (event: string, payload: unknown) => emit(event, payload) };
}
