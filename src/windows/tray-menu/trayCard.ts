import type { CalendarEvent } from "../../features/calendar/api";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import type { MediaState } from "../../features/media/api";
import { sessionLight } from "../../features/agent-status/sessionLight.ts";

export type TrayMedia = {
  title: string | null;
  artist: string | null;
  source: string | null;
  thumbnail: string | null;
  playing: boolean;
  progress: number;
  canNext: boolean;
};

export type TrayMeeting = { title: string; startMs: number; endMs: number; link: string | null };

export type TrayAgents = { running: number; waiting: number };

export const MEETING_LOOKAHEAD_MS = 12 * 60 * 60 * 1000;

export function trayMedia(state: MediaState): TrayMedia | null {
  if (!state.available || state.playbackStatus === "unavailable") return null;
  if (!state.title && !state.artist) return null;
  return {
    title: state.title,
    artist: state.artist,
    source: state.sourceApp,
    thumbnail: state.thumbnail,
    playing: state.playbackStatus === "playing",
    progress: state.durationMs > 0 ? Math.min(1, Math.max(0, state.positionMs / state.durationMs)) : 0,
    canNext: state.canNext,
  };
}

export function nextMeeting(events: readonly CalendarEvent[], now: number): TrayMeeting | null {
  let best: CalendarEvent | null = null;
  for (const event of events) {
    if (event.allDay || event.endMs <= now || event.startMs - now > MEETING_LOOKAHEAD_MS) continue;
    if (!best || event.startMs < best.startMs) best = event;
  }
  return best ? { title: best.title, startMs: best.startMs, endMs: best.endMs, link: best.meetingLink } : null;
}

export function trayAgents(sessions: readonly AgentSessionSummary[]): TrayAgents | null {
  let running = 0;
  let waiting = 0;
  for (const session of sessions) {
    if (session.closed || session.parentId) continue;
    const light = sessionLight(session);
    if (light === "working") running += 1;
    else if (light === "needs" || light === "yourTurn") waiting += 1;
  }
  return running + waiting > 0 ? { running, waiting } : null;
}

export function meetingStartsIn(meeting: TrayMeeting, now: number): { kind: "now" } | { kind: "minutes" | "hours"; value: number } {
  const ms = meeting.startMs - now;
  if (ms <= 0) return { kind: "now" };
  const minutes = Math.ceil(ms / 60000);
  return minutes < 60 ? { kind: "minutes", value: minutes } : { kind: "hours", value: Math.round(minutes / 60) };
}

export function clockRange(meeting: TrayMeeting, locale: string) {
  const format = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${format.format(meeting.startMs)}–${format.format(meeting.endMs)}`;
}
