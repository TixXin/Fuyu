import { useId } from "react";
import { SettingsAdvanced } from "../../components/settings/SettingsAdvanced";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { CALENDAR_BANNER_MINUTES, parseMeetingDomain, type CalendarBannerMinutes } from "./calendarPrefs";
import { useCalendarPrefs } from "./useCalendarPrefs";
import "./CalendarAlertsSection.css";

export function CalendarAlertsSection() {
  const text = useTranslation().settings.calendar;
  const [prefs, setPrefs] = useCalendarPrefs();
  const bannerId = useId();
  const domainInvalid = prefs.customMeetingDomain.trim() !== "" && parseMeetingDomain(prefs.customMeetingDomain) === null;

  return (
    <SettingsGroup title={text.alertsGroup}>
      <SettingsRow
        title={text.bannerEnabled}
        description={text.bannerEnabledHint}
        labelFor={bannerId}
        control={
          <span className="calendar-banner-control">
            <SettingsSelect
              value={String(prefs.bannerMinutes)}
              ariaLabel={text.bannerMinutes}
              disabled={!prefs.bannerEnabled}
              options={CALENDAR_BANNER_MINUTES.map((minutes) => ({ value: String(minutes), label: text.bannerOption(minutes) }))}
              onChange={(value) => setPrefs({ ...prefs, bannerMinutes: Number(value) as CalendarBannerMinutes })}
            />
            <SettingsSwitch id={bannerId} checked={prefs.bannerEnabled} onChange={(bannerEnabled) => setPrefs({ ...prefs, bannerEnabled })} />
          </span>
        }
      />
      <SettingsToggleRow
        title={text.holidayEveReminder}
        description={text.holidayEveReminderHint}
        checked={prefs.holidayEveReminder}
        onChange={(holidayEveReminder) => setPrefs({ ...prefs, holidayEveReminder })}
      />
      <SettingsToggleRow
        title={text.pauseMediaOnJoin}
        description={text.pauseMediaOnJoinHint}
        checked={prefs.pauseMediaOnJoin}
        onChange={(pauseMediaOnJoin) => setPrefs({ ...prefs, pauseMediaOnJoin })}
      />
      <SettingsAdvanced>
        <SettingsRow
          title={text.customDomain}
          description={domainInvalid ? text.customDomainInvalid : text.customDomainHint}
          control={
            <SettingsInput
              monospace
              value={prefs.customMeetingDomain}
              placeholder={text.customDomainPlaceholder}
              aria-label={text.customDomain}
              aria-invalid={domainInvalid || undefined}
              autoComplete="off"
              onChange={(event) => setPrefs({ ...prefs, customMeetingDomain: event.currentTarget.value })}
            />
          }
        />
      </SettingsAdvanced>
    </SettingsGroup>
  );
}
