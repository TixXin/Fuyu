import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import type { CalendarEvent } from "../../src/features/calendar/api";
import type { MediaState } from "../../src/features/media/api";
import type { TrayMenuState } from "../../src/windows/tray-menu/api";
import { nextMeeting, trayAgents, trayMedia } from "../../src/windows/tray-menu/trayCard";

const COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='42' height='42'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23ff8a5b'/%3E%3Cstop offset='1' stop-color='%232bb4ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='42' height='42' fill='url(%23g)'/%3E%3C/svg%3E";

function session(sessionId: string, phase: AgentSessionSummary["phase"], extra: Partial<AgentSessionSummary> = {}): AgentSessionSummary {
  return {
    provider: "claudeCode", sessionId, cwd: "/work/fuyu", title: "fuyu", model: null, effort: null, phase,
    lastMessage: null, updatedAt: 0, host: null, turnStartedAt: null, ...extra,
  };
}

export function trayCardFixtures() {
  const now = new Date(2026, 10, 15, 15, 5).getTime();
  const state: TrayMenuState = {
    islandVisible: true,
    islandBehind: false,
    clipboardPaused: false,
    translateEnabled: false,
    screenshotEnabled: true,
    version: "0.3.10-beta.2",
    updateAvailable: "0.3.10",
    platform: "windows",
  };
  const mediaState: MediaState = {
    available: true, audioActive: true, audioPeak: 0.4, playbackStatus: "playing",
    title: "Night Drive", artist: "Lumen", album: null, thumbnail: COVER, trackId: null,
    positionMs: 84_000, durationMs: 200_000, canSeek: true, canNext: true, canPrevious: true,
    shuffleActive: null, canShuffle: false, repeatMode: "none", canRepeat: false, volume: 0.6,
    sourceApp: "NetEase Music", activeSessionId: null, sessions: [], updatedAt: now,
  };
  const events: CalendarEvent[] = [
    { uid: "a", title: "全天", startMs: now - 3_600_000, endMs: now + 36_000_000, allDay: true, location: null, meetingLink: null, calendar: "工作" },
    { uid: "b", title: "设计评审", startMs: now + 25 * 60_000, endMs: now + 55 * 60_000, allDay: false, location: null, meetingLink: "https://meet.example.com/x", calendar: "工作" },
  ];
  const sessions = [session("1", "running"), session("2", "running"), session("3", "waiting"), session("4", "completed")];
  const shortcuts = { screenshot: "Ctrl+Shift+1", translate: "Ctrl+Shift+F", clipboard: "Ctrl+Shift+W" };
  return {
    now, state, shortcuts, mediaState, events, sessions,
    media: trayMedia(mediaState),
    meeting: nextMeeting(events, now),
    agents: trayAgents(sessions),
  };
}
