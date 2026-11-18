import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import { useBuiltinEnabled } from "../plugin-kernel/useBuiltinPlugins";
import { MAX_FOCUS_TIMER_MINUTES, MIN_FOCUS_TIMER_MINUTES } from "./todoPrefs.ts";
import { useTodoPrefs } from "./useTodoPrefs";

export function TodoFocusSettingsSection() {
  const t = useTranslation();
  const text = t.settings.todo;
  const [prefs, setPrefs] = useTodoPrefs();
  const timerEnabled = useBuiltinEnabled("timer");

  return (
    <SettingsGroup title={text.focusGroup}>
      <SettingsToggleRow
        title={text.focusTimer}
        description={timerEnabled ? text.focusTimerHint : text.focusTimerPluginOffHint}
        checked={prefs.focusTimerEnabled}
        onChange={(focusTimerEnabled) => setPrefs((current) => ({ ...current, focusTimerEnabled }))}
      />
      {prefs.focusTimerEnabled && (
        <SettingsNumberRow
          title={text.focusTimerMinutes}
          indent
          value={prefs.focusTimerMinutes}
          min={MIN_FOCUS_TIMER_MINUTES}
          max={MAX_FOCUS_TIMER_MINUTES}
          onChange={(focusTimerMinutes) => setPrefs((current) => ({ ...current, focusTimerMinutes }))}
        />
      )}
      {!timerEnabled && (
        <SettingsRow
          indent
          searchable={false}
          title={text.focusTimerPluginOff}
          control={
            <SettingsLinkButton onClick={() => void switchBuiltinPlugin("timer", true).catch(() => undefined)}>
              {text.enableTimerPlugin}
            </SettingsLinkButton>
          }
        />
      )}
      <SettingsToggleRow
        title={text.timedReminder}
        description={text.timedReminderHint}
        checked={prefs.timedReminderEnabled}
        onChange={(timedReminderEnabled) => setPrefs((current) => ({ ...current, timedReminderEnabled }))}
      />
      <SettingsToggleRow
        title={text.autoCompleteFromSubtasks}
        description={text.autoCompleteFromSubtasksHint}
        checked={prefs.autoCompleteFromSubtasks}
        onChange={(autoCompleteFromSubtasks) => setPrefs((current) => ({ ...current, autoCompleteFromSubtasks }))}
      />
    </SettingsGroup>
  );
}
