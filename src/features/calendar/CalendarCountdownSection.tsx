import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { CALENDAR_HOLD_MINUTES, COUNTDOWN_SCOPES, type CalendarHoldMinutes, type CountdownScope } from "./calendarPrefs";
import { CALENDAR_REMIND_MINUTES, type CalendarRemindMinutes } from "./calendarSettings";
import { useCalendarPrefs } from "./useCalendarPrefs";

export function CalendarCountdownSection({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.calendar;
  const [prefs, setPrefs] = useCalendarPrefs();

  return (
    <SettingsGroup title={text.island}>
      <SettingsRow
        title={text.remind}
        description={text.remindHint}
        control={
          <SettingsSelect
            value={String(settings.calendarRemindMinutes)}
            ariaLabel={text.remind}
            options={CALENDAR_REMIND_MINUTES.map((minutes) => ({ value: String(minutes), label: text.remindOption(minutes) }))}
            onChange={(value) => onSettingsChange({ ...settings, calendarRemindMinutes: Number(value) as CalendarRemindMinutes })}
          />
        }
      />
      {settings.calendarRemindMinutes > 0 && (
        <>
          <SettingsRow
            indent
            title={text.countdownScope}
            description={text.countdownScopeHint}
            control={
              <SettingsSelect
                value={prefs.countdownScope}
                ariaLabel={text.countdownScope}
                options={COUNTDOWN_SCOPES.map((scope) => ({ value: scope, label: text.countdownScopes[scope] }))}
                onChange={(countdownScope) => setPrefs({ ...prefs, countdownScope: countdownScope as CountdownScope })}
              />
            }
          />
          <SettingsRow
            indent
            title={text.holdMinutes}
            description={text.holdMinutesHint}
            control={
              <SettingsSelect
                value={String(prefs.holdMinutes)}
                ariaLabel={text.holdMinutes}
                options={CALENDAR_HOLD_MINUTES.map((minutes) => ({ value: String(minutes), label: text.holdOption(minutes) }))}
                onChange={(value) => setPrefs({ ...prefs, holdMinutes: Number(value) as CalendarHoldMinutes })}
              />
            }
          />
        </>
      )}
    </SettingsGroup>
  );
}
