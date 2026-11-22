import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsThumbStrip } from "../../components/settings/SettingsThumbStrip";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { CalendarAlertsStage } from "./CalendarAlertsStage";
import { COUNTDOWN_FORMATS, type CountdownFormat } from "./calendarPrefs";
import { demoMeeting } from "./demoMeeting";
import { MeetingLine } from "./MeetingLine";
import type { UpcomingMeeting } from "./upcoming";
import { useCalendarPrefs } from "./useCalendarPrefs";
import "./CalendarDemoSection.css";

function FormatArt({ meeting, format, showTitle }: { meeting: UpcomingMeeting; format: CountdownFormat; showTitle: boolean }) {
  return (
    <span className="calendar-format-art">
      <span className="calendar-format-art__bar">
        <MeetingLine meeting={meeting} showTitle={showTitle} format={format} />
      </span>
    </span>
  );
}

export function CalendarDemoSection({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.calendar;
  const [prefs, setPrefs] = useCalendarPrefs();
  const meeting = demoMeeting(text.demoTitle, settings.calendarRemindMinutes);

  return (
    <SettingsGroup>
      <CalendarAlertsStage
        format={prefs.countdownFormat}
        showTitle={settings.calendarShowTitle}
        remindMinutes={settings.calendarRemindMinutes}
        bannerEnabled={prefs.bannerEnabled}
        bannerMinutes={prefs.bannerMinutes}
      />
      <SettingsRow title={text.countdownFormat} description={text.countdownFormatHint}>
        <SettingsThumbStrip<CountdownFormat>
          wide
          value={prefs.countdownFormat}
          ariaLabel={text.countdownFormat}
          options={COUNTDOWN_FORMATS.map((format) => ({ value: format, label: text.countdownFormatNames[format], hint: text.countdownFormatHints[format] }))}
          renderArt={(format) => <FormatArt meeting={meeting} format={format} showTitle={settings.calendarShowTitle} />}
          onChange={(countdownFormat) => setPrefs({ ...prefs, countdownFormat })}
        />
      </SettingsRow>
      <SettingsToggleRow
        title={text.showTitle}
        description={text.showTitleHint}
        checked={settings.calendarShowTitle}
        onChange={(calendarShowTitle) => onSettingsChange({ ...settings, calendarShowTitle })}
      />
    </SettingsGroup>
  );
}
