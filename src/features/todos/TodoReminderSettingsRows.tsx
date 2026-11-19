import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import {
  TODO_DUE_REMINDER_SCOPES,
  TODO_REMINDER_LEAD_MINUTES,
  parseClockTime,
  type TodoDueReminderScope,
  type TodoReminderLeadMinutes,
} from "./todoPrefs.ts";
import { useTodoPrefs } from "./useTodoPrefs";
import "./TodoReminderSettingsRows.css";

type LeadOptionValue = `${TodoReminderLeadMinutes}`;

export function TodoReminderSettingsRows() {
  const text = useTranslation().settings.todo;
  const [prefs, setPrefs] = useTodoPrefs();

  const leadOptions: readonly { value: LeadOptionValue; label: string }[] = TODO_REMINDER_LEAD_MINUTES.map((minutes) => ({
    value: `${minutes}`,
    label: minutes === 0 ? text.timedReminderLeadOnTime : text.timedReminderLeadMinutes(minutes),
  }));

  const scopeOptions: readonly { value: TodoDueReminderScope; label: string }[] = TODO_DUE_REMINDER_SCOPES.map((scope) => ({
    value: scope,
    label: text.dueReminderScopeOptions[scope],
  }));

  return (
    <>
      <SettingsToggleRow
        title={text.timedReminder}
        description={text.timedReminderHint}
        checked={prefs.timedReminderEnabled}
        onChange={(timedReminderEnabled) => setPrefs((current) => ({ ...current, timedReminderEnabled }))}
      />
      {prefs.timedReminderEnabled && (
        <SettingsRow
          indent
          title={text.timedReminderLead}
          control={
            <SettingsSelect
              value={`${prefs.timedReminderLeadMinutes}` as LeadOptionValue}
              options={leadOptions}
              ariaLabel={text.timedReminderLead}
              onChange={(value) =>
                setPrefs((current) => ({ ...current, timedReminderLeadMinutes: Number(value) as TodoReminderLeadMinutes }))
              }
            />
          }
        />
      )}
      <SettingsRow
        title={text.dueReminderScope}
        description={text.dueReminderScopeHint}
        control={
          <SettingsSelect
            value={prefs.dueReminderScope}
            options={scopeOptions}
            ariaLabel={text.dueReminderScope}
            onChange={(dueReminderScope) => setPrefs((current) => ({ ...current, dueReminderScope }))}
          />
        }
      />
      <SettingsToggleRow
        title={text.wrapUpReminder}
        description={text.wrapUpReminderHint}
        checked={prefs.wrapUpReminderEnabled}
        onChange={(wrapUpReminderEnabled) => setPrefs((current) => ({ ...current, wrapUpReminderEnabled }))}
      />
      {prefs.wrapUpReminderEnabled && (
        <SettingsRow
          indent
          title={text.wrapUpReminderTime}
          control={
            <SettingsInput
              type="time"
              className="todo-reminder-time"
              aria-label={text.wrapUpReminderTime}
              value={prefs.wrapUpReminderTime}
              onChange={(event) => {
                const wrapUpReminderTime = event.currentTarget.value;
                if (parseClockTime(wrapUpReminderTime)) setPrefs((current) => ({ ...current, wrapUpReminderTime }));
              }}
            />
          }
        />
      )}
    </>
  );
}
