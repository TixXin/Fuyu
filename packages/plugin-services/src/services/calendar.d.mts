import type { ServiceDefinition } from "../define.mjs";
import type { CalendarEvents } from "../generated/rust.mjs";

export type { CalendarEvent, CalendarEvents, CalendarProblem } from "../generated/rust.mjs";

export type CalendarSourceKind = "ics" | "caldav" | "plugin" | (string & {});

export type CalendarSource = {
  id: string;
  kind: CalendarSourceKind;
  name: string;
  host: string;
};

export type CalendarMethods = {
  events(params: { refresh?: boolean }): CalendarEvents;
  sources(): { sources: CalendarSource[] };
};

export type CalendarServiceEvents = {
  changed: Record<string, never>;
};

export const calendarV1: ServiceDefinition<CalendarMethods, CalendarServiceEvents, {}>;
