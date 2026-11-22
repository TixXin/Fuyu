import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../i18n";
import type { CalendarBannerMinutes, CountdownFormat } from "./calendarPrefs";
import { demoMeeting } from "./demoMeeting";
import { MeetingBannerNotice } from "./MeetingBannerNotice";
import { MeetingLine } from "./MeetingLine";
import { clockTime, formatMeetingBanner } from "./upcoming";
import "./CalendarAlertsStage.css";

const BANNER_MS = 4200;

export function CalendarAlertsStage({ format, showTitle, remindMinutes, bannerEnabled, bannerMinutes }: {
  format: CountdownFormat;
  showTitle: boolean;
  remindMinutes: number;
  bannerEnabled: boolean;
  bannerMinutes: CalendarBannerMinutes;
}) {
  const t = useTranslation();
  const text = t.settings.calendar;
  const [run, setRun] = useState(0);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (!showing) return;
    const timer = window.setTimeout(() => {
      setShowing(false);
      setRun((current) => current + 1);
    }, BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [showing, run]);

  const meeting = demoMeeting(text.demoTitle, remindMinutes);
  const mode = showing && bannerEnabled ? "banner" : remindMinutes > 0 ? "line" : "idle";
  const banner = formatMeetingBanner({ id: "fuyu-demo", event: meeting.event, minutes: bannerMinutes }, showTitle, t.calendar);
  const caption = mode === "banner"
    ? text.demoCaptionBanner(text.bannerOption(bannerMinutes))
    : mode === "line"
      ? text.demoCaption(clockTime(meeting.event.startMs), text.demoTitle, meeting.minutes)
      : text.demoCaptionOff;

  return (
    <div className="calendar-stage" data-search="off">
      <div className="calendar-stage__scene" role="img" aria-label={`${text.demoLabel}: ${caption}`}>
        <span className={`calendar-stage__bar calendar-stage__bar--${mode}${run > 0 ? " calendar-stage__bar--played" : ""}`} key={`${mode}:${run}`}>
          {mode === "line" && (
            <>
              <MeetingLine meeting={meeting} showTitle={showTitle} format={format} />
              <span className="island-meeting-join">{t.calendar.join}</span>
            </>
          )}
          {mode === "banner" && (
            <>
              <MeetingBannerNotice banner={banner} />
              <span className="screenshot-notice__actions">
                <span className="island-meeting-join">{t.calendar.joinNow}</span>
                <span className="screenshot-notice__action">
                  <X size={13} strokeWidth={2} />
                </span>
              </span>
            </>
          )}
        </span>
      </div>
      <p className="calendar-stage__caption">{caption}</p>
      <div className="calendar-stage__controls">
        <SettingsLinkButton
          disabled={!bannerEnabled}
          onClick={() => {
            setShowing(true);
            setRun((current) => current + 1);
          }}
        >
          <Play size={13} strokeWidth={2.2} aria-hidden="true" />
          {text.demoBanner}
        </SettingsLinkButton>
        {!bannerEnabled && <span className="calendar-stage__note">{text.demoBannerOff}</span>}
      </div>
    </div>
  );
}
