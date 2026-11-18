import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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
  declined?: boolean;
  free?: boolean;
};

export type CalendarSnapshot = {
  events: CalendarEvent[];
  problems: { sourceId: string; message: NativeError | string }[];
  fetchedAt: number;
  fromMs: number;
  toMs: number;
  sourceCount: number;
  calendarColors?: Record<string, string>;
};

export type CalendarSourceKind = "ics" | "caldav";

export type SubCalendar = {
  name: string;
  color?: string | null;
};

export type CalendarSource = {
  id: string;
  kind: CalendarSourceKind;
  name: string;
  url: string;
  host: string;
  username: string;
  calendars?: SubCalendar[];
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

export const CALENDAR_JOIN_SHORTCUT_EVENT = "calendar-join-shortcut";
export const CALENDAR_SHORTCUT_STATUS_EVENT = "calendar-shortcut-status";

export type CalendarShortcutProblem = "invalid" | "taken";

export function listenCalendarJoinShortcut(handler: () => void): Promise<UnlistenFn> {
  return listen(CALENDAR_JOIN_SHORTCUT_EVENT, () => handler());
}

export function getCalendarShortcutProblem(): Promise<CalendarShortcutProblem | null> {
  return invoke<CalendarShortcutProblem | null>("get_calendar_shortcut_problem");
}

export function listenCalendarShortcutProblem(handler: (problem: CalendarShortcutProblem | null) => void): Promise<UnlistenFn> {
  return listen<CalendarShortcutProblem | null>(CALENDAR_SHORTCUT_STATUS_EVENT, ({ payload }) => handler(payload));
}
