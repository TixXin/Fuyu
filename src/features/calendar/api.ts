import { invoke } from "@tauri-apps/api/core";
import type { NativeError } from "../../i18n/nativeError";
import { openUrl } from "@tauri-apps/plugin-opener";

export function openMeetingLink(link: string) {
  return openUrl(link);
}

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

export type CalendarSnapshot = {
  events: CalendarEvent[];
  problems: { sourceId: string; message: NativeError | string }[];
  fetchedAt: number;
  fromMs: number;
  toMs: number;
  sourceCount: number;
};

export type CalendarSourceKind = "ics" | "caldav";

export type CalendarSource = {
  id: string;
  kind: CalendarSourceKind;
  name: string;
  url: string;
  host: string;
  username: string;
};

export function getCalendarEvents(refresh = false) {
  return invoke<CalendarSnapshot>("get_calendar_events", { refresh });
}

export function listCalendarSources() {
  return invoke<CalendarSource[]>("list_calendar_sources");
}

export function addCalendarSource(source: { kind: CalendarSourceKind; name: string; url: string; username: string; secret: string }) {
  return invoke<CalendarSource>("add_calendar_source", source);
}

export function removeCalendarSource(id: string) {
  return invoke<void>("remove_calendar_source", { id });
}
