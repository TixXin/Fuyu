import { BellRing, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { joinCalendarMeeting } from "./joinMeeting";
import type { MeetingBannerPayload } from "./upcoming";
import "../../components/notice/IslandNotice.css";
import "./MeetingLine.css";

export function MeetingBannerNotice({ banner }: { banner: MeetingBannerPayload }) {
  const label = `${banner.title} · ${banner.detail}`;
  return (
    <span className="screenshot-notice calendar-banner-notice" role="alert">
      <BellRing size={14} strokeWidth={2.2} aria-hidden="true" />
      <span className="screenshot-notice__text">{label}</span>
    </span>
  );
}

export function MeetingBannerActions({
  banner,
  pauseMediaOnJoin,
  onDismiss,
}: {
  banner: MeetingBannerPayload;
  pauseMediaOnJoin: boolean;
  onDismiss: () => void;
}) {
  const text = useTranslation().calendar;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  return (
    <span className="screenshot-notice__actions">
      {banner.meetingLink && (
        <button
          className="island-meeting-join"
          type="button"
          onClick={stop(() => {
            joinCalendarMeeting(banner.meetingLink!, pauseMediaOnJoin);
            onDismiss();
          })}
        >
          {text.joinNow}
        </button>
      )}
      <button
        className="screenshot-notice__action"
        type="button"
        aria-label={text.dismissReminder}
        onClick={stop(onDismiss)}
      >
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
