import { CalendarClock } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { CountdownFormat } from "./calendarPrefs";
import { clockTime, type UpcomingMeeting } from "./upcoming";
import "./MeetingLine.css";

export function MeetingLine({
  meeting,
  showTitle,
  format = "titleMinutes",
}: {
  meeting: UpcomingMeeting;
  showTitle: boolean;
  format?: CountdownFormat;
}) {
  const text = useTranslation().calendar;
  const startedClass = meeting.minutes === 0 ? " island-meeting--started" : "";
  const shortWhen = meeting.minutes > 0
    ? `${meeting.minutes}m`
    : meeting.remainingEndMinutes !== undefined
      ? text.endsInShort(meeting.remainingEndMinutes)
      : text.started;

  if (format === "compact") {
    return (
      <span className={`island-meeting island-meeting--compact${startedClass}`}>
        <CalendarClock className="island-meeting__icon" size={15} strokeWidth={2.2} aria-hidden="true" />
        <span className="island-meeting__when">{shortWhen}</span>
      </span>
    );
  }

  const baseTitle = showTitle && meeting.event.title ? meeting.event.title : text.meeting;
  if (format === "timeTitle") {
    return (
      <span className={`island-meeting${startedClass}`}>
        <CalendarClock className="island-meeting__icon" size={15} strokeWidth={2.2} aria-hidden="true" />
        <span className="island-meeting__title">{`${clockTime(meeting.event.startMs)} ${baseTitle}`}</span>
        <span className="island-meeting__when">· {shortWhen}</span>
      </span>
    );
  }

  const when = meeting.minutes > 0
    ? text.inMinutes(meeting.minutes)
    : meeting.remainingEndMinutes !== undefined
      ? text.endsInMinutes(meeting.remainingEndMinutes)
      : text.started;
  return (
    <span className={`island-meeting${startedClass}`}>
      <CalendarClock className="island-meeting__icon" size={15} strokeWidth={2.2} aria-hidden="true" />
      <span className="island-meeting__title">{baseTitle}</span>
      <span className="island-meeting__when">· {when}</span>
    </span>
  );
}
