import { CalendarDays } from "lucide-react";
import { useTranslation } from "../../i18n";
import { clockRange, meetingStartsIn, type TrayMeeting } from "./trayCard";
import type { TrayCardHandlers } from "./types";

export function MeetingBlock({ meeting, now, handlers }: { meeting: TrayMeeting; now: number; handlers: TrayCardHandlers }) {
  const t = useTranslation();
  const text = t.trayMenu;
  const starts = meetingStartsIn(meeting, now);
  const when = starts.kind === "now" ? text.meetingNow : starts.kind === "minutes" ? text.meetingIn(starts.value) : text.meetingInHours(starts.value);
  return (
    <div className="tray-card__block">
      <span className="tray-card__block-icon" aria-hidden="true">
        <CalendarDays size={16} />
      </span>
      <span className="tray-card__block-text">
        <b>{meeting.title}</b>
        <span>{`${when} · ${clockRange(meeting, t.localeTag)}`}</span>
      </span>
      {meeting.link ? (
        <button type="button" className="tray-card__mini" aria-label={`${text.join}${text.separator}${meeting.title}`} onClick={handlers.onJoin}>
          {text.join}
        </button>
      ) : (
        <button
          type="button"
          className="tray-card__icon-button"
          aria-label={text.openPage(text.pages.calendar)}
          title={text.pages.calendar}
          onClick={() => handlers.onAction("open_page", "calendar")}
        >
          <CalendarDays size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
