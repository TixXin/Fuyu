import type { CalendarEvent, CalendarEvents, CalendarProblem, CalendarSource, CalendarSourceKind } from "@fuyu/plugin-services";

export type CustomCalendarSourceSpec = {
  id: string;
  name: string;
  host?: string;
  kind?: CalendarSourceKind;
  events(params: {
    refresh: boolean;
    fromMs: number;
    toMs: number;
  }): Promise<CalendarEvent[] | { events: CalendarEvent[]; problems?: CalendarProblem[] }> | CalendarEvent[] | { events: CalendarEvent[]; problems?: CalendarProblem[] };
};

export type CalendarSourceRegistry = {
  register(spec: CustomCalendarSourceSpec): () => void;
  has(id: unknown): boolean;
  list(): CalendarSource[];
  collect(params?: { refresh?: boolean; fromMs?: number; toMs?: number }): Promise<{ events: CalendarEvent[]; problems: CalendarProblem[]; sourceCount: number }>;
  subscribe(listener: () => void): () => void;
};

export function normalizeCalendarEvent(event: Record<string, unknown>, fallbackCalendar?: string): CalendarEvent;
export function normalizeCalendarProblem(problem: Record<string, unknown>, fallbackSourceId?: string): CalendarProblem;
export function createCalendarSourceRegistry(): CalendarSourceRegistry;
export function mergeCalendarEvents(base: CalendarEvents, registry: CalendarSourceRegistry, refresh?: boolean): Promise<CalendarEvents>;
export function mergeCalendarSources(base: { sources: CalendarSource[] }, registry: CalendarSourceRegistry): { sources: CalendarSource[] };
export const calendarSources: CalendarSourceRegistry;
export function registerCalendarSource(spec: CustomCalendarSourceSpec): () => void;
export function subscribeCalendarSources(listener: () => void): () => void;
