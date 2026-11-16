export type AppEcho = { echo: JsonValue, };

export type AppVersion = { version: string, platform: string, };

export type CalendarEvent = { uid: string, title: string, startMs: number, endMs: number, allDay: boolean, location: string | null, meetingLink: string | null, calendar: string, };

export type CalendarEvents = { events: Array<CalendarEvent>, problems: Array<CalendarProblem>, fetchedAt: number, fromMs: number, toMs: number, sourceCount: number, };

export type CalendarProblem = { sourceId: string, reason: string, message: string, };

export type CalendarSourceInfo = { id: string, kind: string, name: string, host: string, };

export type CalendarSources = { sources: Array<CalendarSourceInfo>, };

export type EngineSecret = { engine: string, hasSecret: boolean, };

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

export type PlatformSupport = { os: string, unsupported: Array<string>, devBuild: boolean, };

export type Translated = { text: string, engine: string, };

export type TranslatorEngines = { engines: Array<EngineSecret>, };

export type RustMethods = {
  "app.echo": { params: { value: JsonValue }; result: AppEcho };
  "app.platformSupport": { params: Record<string, never> | null; result: PlatformSupport };
  "app.version": { params: Record<string, never> | null; result: AppVersion };
  "calendar.events": { params: { refresh?: boolean | null }; result: CalendarEvents };
  "calendar.sources": { params: Record<string, never> | null; result: CalendarSources };
  "translator.engines": { params: Record<string, never> | null; result: TranslatorEngines };
  "translator.rewrite": { params: { text: string; task: string; prompt?: string | null; provider?: string | null; model?: string | null }; result: Translated };
  "translator.translate": { params: { text: string; direction: string; provider?: string | null; model?: string | null }; result: Translated };
};

export declare const RUST_METHODS: readonly ["app.echo", "app.platformSupport", "app.version", "calendar.events", "calendar.sources", "translator.engines", "translator.rewrite", "translator.translate"];
