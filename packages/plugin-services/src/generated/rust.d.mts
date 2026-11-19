export type AgentFocus = { found: boolean, };

export type AgentRemoteHosts = { hosts: Array<RemoteHostStatus>, };

export type AgentReportEntry = { id: string, name: string, phase: string, updatedAt: number, };

export type AgentSessionEntry = { key: string, provider: string, sessionId: string, title: string | null, cwd: string | null, phase: string, light: string, updatedAt: number, remoteHost: string | null, listed: boolean, unseen: boolean, };

export type AgentSessions = { sessions: Array<AgentSessionEntry>, others: Array<AgentReportEntry>, };

export type AgentUsageReport = { updatedAt: number | null, fiveHour: AgentUsageWindow | null, sevenDay: AgentUsageWindow | null, models: Array<AgentUsageWindow>, plan: string | null, source: string, error: string | null, };

export type AgentUsageWindow = { name: string, used: number, resetsAt: number | null, };

export type AgentUsages = { claude: AgentUsageReport | null, codex: AgentUsageReport | null, };

export type AppEcho = { echo: JsonValue, };

export type AppVersion = { version: string, platform: string, };

export type CalendarEvent = { uid: string, title: string, startMs: number, endMs: number, allDay: boolean, location: string | null, meetingLink: string | null, calendar: string, declined: boolean, free: boolean, };

export type CalendarEvents = { events: Array<CalendarEvent>, problems: Array<CalendarProblem>, fetchedAt: number, fromMs: number, toMs: number, sourceCount: number, };

export type CalendarProblem = { sourceId: string, reason: string, message: string, };

export type CalendarSourceInfo = { id: string, kind: string, name: string, host: string, };

export type CalendarSources = { sources: Array<CalendarSourceInfo>, };

export type ClipboardText = { id: string, text: string, truncated: boolean, copiedAt: number, favorite: boolean, };

export type ClipboardTexts = { items: Array<ClipboardText>, };

export type EngineSecret = { engine: string, hasSecret: boolean, };

export type FileShelfEntry = { missing: boolean, unreachable: boolean, id: string, path: string, name: string, isDir: boolean, size: number, addedAt: number, pinned: boolean, };

export type FileShelfSnapshot = { items: Array<FileShelfEntry>, };

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

export type NowPlaying = { available: boolean, playing: boolean, audible: boolean, title: string | null, artist: string | null, album: string | null, sourceApp: string | null, sourceFrontmost: boolean, positionMs: number, durationMs: number, canSeek: boolean, canNext: boolean, canPrevious: boolean, updatedAt: number, };

export type PlatformSupport = { os: string, unsupported: Array<string>, devBuild: boolean, };

export type PluginHotkeyBindings = Array<PluginHotkeySpec>;

export type PluginHotkeySpec = { pluginId: string, command: string, shortcut: string, };

export type PluginHotkeySyncResult = { conflicts: { [key in string]: Array<string> }, };

export type PluginWindowInfo = { pluginId: string, windowId: string, label: string, kind: string, title: string, width: number, height: number, x: number | null, y: number | null, visible: boolean, focused: boolean, alwaysOnTop: boolean, resizable: boolean, clickThrough: boolean, };

export type PluginWindowList = { windows: Array<PluginWindowInfo>, };

export type PluginWindowOpenSpec = { pluginId: string, windowId: string, kind: string, title?: string | null, width: number, height: number, x?: number | null, y?: number | null, alwaysOnTop?: boolean | null, resizable?: boolean | null, visible?: boolean | null, clickThrough?: boolean | null, };

export type RemoteHostStatus = { host: string, fetchedAt: number | null, error: string | null, fetching: boolean, sessions: number, approvalError: string | null, };

export type Translated = { text: string, engine: string, };

export type TranslatorEngines = { engines: Array<EngineSecret>, };

export type RustMethods = {
  "agents.focus": { params: { provider: string; sessionId?: string | null; cwd?: string | null; title?: string | null }; result: AgentFocus };
  "agents.remoteHosts": { params: Record<string, never> | null; result: AgentRemoteHosts };
  "agents.sessions": { params: Record<string, never> | null; result: AgentSessions };
  "agents.usage": { params: Record<string, never> | null; result: AgentUsages };
  "app.echo": { params: { value: JsonValue }; result: AppEcho };
  "app.platformSupport": { params: Record<string, never> | null; result: PlatformSupport };
  "app.version": { params: Record<string, never> | null; result: AppVersion };
  "calendar.events": { params: { refresh?: boolean | null }; result: CalendarEvents };
  "calendar.sources": { params: Record<string, never> | null; result: CalendarSources };
  "clipboard.history": { params: { limit?: number | null }; result: ClipboardTexts };
  "fileShelf.add": { params: { paths: Array<string> }; result: FileShelfSnapshot };
  "fileShelf.list": { params: Record<string, never> | null; result: FileShelfSnapshot };
  "media.next": { params: Record<string, never> | null; result: NowPlaying };
  "media.nowPlaying": { params: Record<string, never> | null; result: NowPlaying };
  "media.playPause": { params: Record<string, never> | null; result: NowPlaying };
  "media.previous": { params: Record<string, never> | null; result: NowPlaying };
  "media.seek": { params: { positionMs: number }; result: NowPlaying };
  "pluginKernel.syncHotkeys": { params: { bindings: PluginHotkeyBindings }; result: PluginHotkeySyncResult };
  "pluginKernel.windowControl": { params: { pluginId: string; windowId?: string | null; action: string; title?: string | null; width?: number | null; height?: number | null; x?: number | null; y?: number | null; alwaysOnTop?: boolean | null; resizable?: boolean | null; clickThrough?: boolean | null }; result: PluginWindowInfo | null };
  "pluginKernel.windowList": { params: { pluginId?: string | null }; result: PluginWindowList };
  "pluginKernel.windowOpen": { params: { spec: PluginWindowOpenSpec }; result: PluginWindowInfo };
  "todos.add": { params: { title?: JsonValue | null; date?: JsonValue | null; project?: JsonValue | null }; result: JsonValue };
  "todos.days": { params: { from?: JsonValue | null; to?: JsonValue | null }; result: JsonValue };
  "todos.list": { params: { date?: JsonValue | null }; result: JsonValue };
  "todos.note": { params: { date?: JsonValue | null }; result: JsonValue };
  "todos.remove": { params: { id?: JsonValue | null }; result: JsonValue };
  "todos.setNote": { params: { note?: JsonValue | null; append?: JsonValue | null }; result: JsonValue };
  "todos.update": { params: { id?: JsonValue | null; title?: JsonValue | null; completed?: JsonValue | null; addFocusMinutes?: JsonValue | null }; result: JsonValue };
  "translator.engines": { params: Record<string, never> | null; result: TranslatorEngines };
  "translator.rewrite": { params: { text: string; task: string; prompt?: string | null; provider?: string | null; model?: string | null }; result: Translated };
  "translator.translate": { params: { text: string; direction: string; provider?: string | null; model?: string | null }; result: Translated };
};

export declare const RUST_METHODS: readonly ["agents.focus", "agents.remoteHosts", "agents.sessions", "agents.usage", "app.echo", "app.platformSupport", "app.version", "calendar.events", "calendar.sources", "clipboard.history", "fileShelf.add", "fileShelf.list", "media.next", "media.nowPlaying", "media.playPause", "media.previous", "media.seek", "pluginKernel.syncHotkeys", "pluginKernel.windowControl", "pluginKernel.windowList", "pluginKernel.windowOpen", "todos.add", "todos.days", "todos.list", "todos.note", "todos.remove", "todos.setNote", "todos.update", "translator.engines", "translator.rewrite", "translator.translate"];
