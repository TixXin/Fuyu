export type AppEcho = { echo: JsonValue, };

export type AppVersion = { version: string, platform: string, };

export type CalendarEvent = { uid: string, title: string, startMs: number, endMs: number, allDay: boolean, location: string | null, meetingLink: string | null, calendar: string, };

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

export type NowPlaying = { available: boolean, playing: boolean, audible: boolean, title: string | null, artist: string | null, album: string | null, sourceApp: string | null, positionMs: number, durationMs: number, canSeek: boolean, canNext: boolean, canPrevious: boolean, updatedAt: number, };

export type PlatformSupport = { os: string, unsupported: Array<string>, devBuild: boolean, };

export type Translated = { text: string, engine: string, };

export type TranslatorEngines = { engines: Array<EngineSecret>, };

export type RustMethods = {
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
  "todos.add": { params: { title?: JsonValue | null; date?: JsonValue | null; project?: JsonValue | null }; result: JsonValue };
  "todos.days": { params: { from?: JsonValue | null; to?: JsonValue | null }; result: JsonValue };
  "todos.list": { params: { date?: JsonValue | null }; result: JsonValue };
  "todos.note": { params: { date?: JsonValue | null }; result: JsonValue };
  "todos.remove": { params: { id?: JsonValue | null }; result: JsonValue };
  "todos.setNote": { params: { note?: JsonValue | null; append?: JsonValue | null }; result: JsonValue };
  "todos.update": { params: { id?: JsonValue | null; title?: JsonValue | null; completed?: JsonValue | null }; result: JsonValue };
  "translator.engines": { params: Record<string, never> | null; result: TranslatorEngines };
  "translator.rewrite": { params: { text: string; task: string; prompt?: string | null; provider?: string | null; model?: string | null }; result: Translated };
  "translator.translate": { params: { text: string; direction: string; provider?: string | null; model?: string | null }; result: Translated };
};

export declare const RUST_METHODS: readonly ["app.echo", "app.platformSupport", "app.version", "calendar.events", "calendar.sources", "clipboard.history", "fileShelf.add", "fileShelf.list", "media.next", "media.nowPlaying", "media.playPause", "media.previous", "media.seek", "todos.add", "todos.days", "todos.list", "todos.note", "todos.remove", "todos.setNote", "todos.update", "translator.engines", "translator.rewrite", "translator.translate"];
