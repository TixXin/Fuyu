import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { useCalendarPrefs } from "./useCalendarPrefs";

export function CalendarFilterSection() {
  const text = useTranslation().settings.calendar;
  const [prefs, setPrefs] = useCalendarPrefs();

  return (
    <SettingsGroup title={text.filterGroup}>
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
        title={text.includeTimedTodos}
        description={text.includeTimedTodosHint}
        checked={prefs.includeTimedTodos}
        onChange={(includeTimedTodos) => setPrefs({ ...prefs, includeTimedTodos })}
      />
    </SettingsGroup>
  );
}
