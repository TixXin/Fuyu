import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { WEEK_STARTS_ON, type AgendaRange, type WeekStartsOn } from "./calendarPrefs";
import { useCalendarPrefs } from "./useCalendarPrefs";

export function CalendarPanelPrefsSection() {
  const text = useTranslation().settings.calendar;
  const [prefs, setPrefs] = useCalendarPrefs();

  return (
    <SettingsGroup title={text.panelGroup}>
      <SettingsRow
        title={text.agendaRange}
        description={text.agendaRangeHint}
        control={
          <SettingsChoice<AgendaRange>
            value={prefs.agendaRange}
            ariaLabel={text.agendaRange}
            options={[
              { value: "twoDays", label: text.rangeTwoDays },
              { value: "sevenDays", label: text.rangeSevenDays },
            ]}
            onChange={(agendaRange) => setPrefs({ ...prefs, agendaRange })}
          />
        }
      />
      <SettingsToggleRow
        title={text.hideDeclined}
        description={text.hideDeclinedHint}
        checked={prefs.hideDeclined}
        onChange={(hideDeclined) => setPrefs({ ...prefs, hideDeclined })}
      />
      <SettingsToggleRow
        title={text.ignoreFreeInCountdown}
        description={text.ignoreFreeInCountdownHint}
        checked={prefs.ignoreFreeInCountdown}
        onChange={(ignoreFreeInCountdown) => setPrefs({ ...prefs, ignoreFreeInCountdown })}
      />
      <SettingsToggleRow
        title={text.foldAllDay}
        description={text.foldAllDayHint}
        checked={prefs.foldAllDay}
        onChange={(foldAllDay) => setPrefs({ ...prefs, foldAllDay })}
      />
      <SettingsToggleRow
        title={text.showWeekNumbers}
        description={text.showWeekNumbersHint}
        checked={prefs.showWeekNumbers}
        onChange={(showWeekNumbers) => setPrefs({ ...prefs, showWeekNumbers })}
      />
      <SettingsRow
        title={text.weekStartsOn}
        control={
          <SettingsChoice<WeekStartsOn>
            value={prefs.weekStartsOn}
            ariaLabel={text.weekStartsOn}
            options={WEEK_STARTS_ON.map((option) => ({ value: option, label: text.weekStartsOnOptions[option] }))}
            onChange={(weekStartsOn) => setPrefs({ ...prefs, weekStartsOn })}
          />
        }
      />
      <SettingsToggleRow
        title={text.includeTimedTodos}
        description={text.includeTimedTodosHint}
        checked={prefs.includeTimedTodos}
        onChange={(includeTimedTodos) => setPrefs({ ...prefs, includeTimedTodos })}
      />
    </SettingsGroup>
  );
}
