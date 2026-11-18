import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { CALENDAR_BANNER_MINUTES, parseMeetingDomain, type CalendarBannerMinutes } from "./calendarPrefs";
import { useCalendarPrefs } from "./useCalendarPrefs";

export function CalendarAlertsSection() {
  const text = useTranslation().settings.calendar;
  const [prefs, setPrefs] = useCalendarPrefs();
  const domainInvalid = prefs.customMeetingDomain.trim() !== "" && parseMeetingDomain(prefs.customMeetingDomain) === null;

  return (
    <SettingsGroup title={text.alertsGroup}>
      <SettingsToggleRow
        title={text.bannerEnabled}
        description={text.bannerEnabledHint}
        checked={prefs.bannerEnabled}
        onChange={(bannerEnabled) => setPrefs({ ...prefs, bannerEnabled })}
      />
      {prefs.bannerEnabled && (
        <SettingsRow
          indent
          title={text.bannerMinutes}
          control={
            <SettingsSelect
              value={String(prefs.bannerMinutes)}
              ariaLabel={text.bannerMinutes}
              options={CALENDAR_BANNER_MINUTES.map((minutes) => ({ value: String(minutes), label: text.bannerOption(minutes) }))}
              onChange={(value) => setPrefs({ ...prefs, bannerMinutes: Number(value) as CalendarBannerMinutes })}
            />
          }
        />
      )}
      <SettingsToggleRow
        title={text.pauseMediaOnJoin}
        description={text.pauseMediaOnJoinHint}
        checked={prefs.pauseMediaOnJoin}
        onChange={(pauseMediaOnJoin) => setPrefs({ ...prefs, pauseMediaOnJoin })}
      />
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
    </SettingsGroup>
  );
}
