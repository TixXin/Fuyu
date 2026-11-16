import { useCallback, useState } from "react";
import { listAgentSessions } from "../../features/agent-status/api";
import { getCalendarEvents, openMeetingLink } from "../../features/calendar/api";
import { getMediaState, sendMediaCommand, type MediaCommand } from "../../features/media/api";
import { nextMeeting, trayAgents, trayMedia, type TrayAgents, type TrayMedia, type TrayMeeting } from "./trayCard";

type StatusData = { media: TrayMedia | null; meeting: TrayMeeting | null; agents: TrayAgents | null; now: number };

const EMPTY: StatusData = { media: null, meeting: null, agents: null, now: 0 };

function settle<T>(promise: Promise<T>, label: string): Promise<T | null> {
  return promise.catch((error: unknown) => {
    console.error(`Failed to read ${label} for the tray card`, error);
    return null;
  });
}

export function useTrayMenuStatus() {
  const [status, setStatus] = useState<StatusData>(EMPTY);

  const refresh = useCallback(async () => {
    const now = Date.now();
    const [media, calendar, sessions] = await Promise.all([
      settle(getMediaState(undefined), "media"),
      settle(getCalendarEvents(), "calendar"),
      settle(listAgentSessions(), "agent sessions"),
    ]);
    setStatus({
      media: media ? trayMedia(media) : null,
      meeting: calendar ? nextMeeting(calendar.events, now) : null,
      agents: sessions ? trayAgents(sessions) : null,
      now,
    });
  }, []);

  const media = useCallback(async (command: MediaCommand) => {
    const next = await settle(sendMediaCommand(command, undefined), "media");
    if (next) setStatus((current) => ({ ...current, media: trayMedia(next) }));
  }, []);

  const join = useCallback(async () => {
    const link = status.meeting?.link;
    if (link) await settle(openMeetingLink(link), "the meeting link");
  }, [status.meeting]);

  return { status, refresh, media, join };
}
