import type { ServiceDefinition } from "../define.mjs";

export type CalendarEvent = {
  uid: string;
  title: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  location: string | null;
  meetingLink: string | null;
  calendar: string;
};

export type CalendarProblem = {
  sourceId: string;
  reason: string;
  message: string;
};

export type CalendarEvents = {
  events: CalendarEvent[];
  problems: CalendarProblem[];
  fetchedAt: number;
  fromMs: number;
  toMs: number;
  sourceCount: number;
};

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
