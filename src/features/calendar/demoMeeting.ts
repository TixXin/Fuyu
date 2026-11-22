import type { CalendarEvent } from "./api";
import type { UpcomingMeeting } from "./upcoming";

const DEMO_MINUTES = 10;
const DEMO_LENGTH_MS = 30 * 60_000;

export function demoMeeting(title: string, remindMinutes: number): UpcomingMeeting {
  const startMs = new Date(2026, 0, 5, 14, 0, 0, 0).getTime();
  const event: CalendarEvent = {
    uid: "fuyu-demo",
    title,
    startMs,
    endMs: startMs + DEMO_LENGTH_MS,
    allDay: false,
    location: null,
    meetingLink: "https://meet.example.com/demo",
    calendar: "",
  };
  return { event, minutes: remindMinutes > 0 ? Math.min(DEMO_MINUTES, remindMinutes) : DEMO_MINUTES };
}
