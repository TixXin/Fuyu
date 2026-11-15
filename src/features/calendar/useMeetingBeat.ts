import { useEffect, useState } from "react";
import { meetingBeatAt, meetingBeats } from "./meetingBeats";
import type { UpcomingMeeting } from "./upcoming";

type Seen = { id: string; at: number };

export function useMeetingBeat(meeting: UpcomingMeeting | null): boolean {
  const id = meeting ? `${meeting.event.uid}:${meeting.event.startMs}` : null;
  const [seen, setSeen] = useState<Seen | null>(null);
  const [now, setNow] = useState(() => Date.now());
  if (id !== (seen?.id ?? null)) setSeen(id ? { id, at: Date.now() } : null);
  const current = seen && seen.id === id && meeting ? seen : null;
  const beat = current && meeting ? meetingBeatAt(meetingBeats(meeting.event.startMs, current.at), Math.max(now, current.at)) : null;
  const changeAt = beat?.changeAt ?? null;

  useEffect(() => {
    if (changeAt === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(20, changeAt - Date.now() + 20));
    return () => window.clearTimeout(timer);
  }, [changeAt]);

  return beat?.showing ?? false;
}
