import type { ServiceDefinition } from "../define.mjs";
import type { CalendarEvents } from "../generated/rust.mjs";

export type { CalendarEvent, CalendarEvents, CalendarProblem } from "../generated/rust.mjs";

export type CalendarSource = {
  id: string;
  kind: "ics" | "caldav";
  name: string;
  host: string;
};

export type CalendarMethods = {
  events(params: { refresh?: boolean }): CalendarEvents;
  sources(): { sources: CalendarSource[] };
};

export const calendarV1: ServiceDefinition<CalendarMethods, {}, {}>;
