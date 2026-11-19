import { useId } from "react";
import { Volume2 } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import {
  TODO_DUE_REMINDER_SCOPES,
  TODO_REMINDER_LEAD_MINUTES,
  parseClockTime,
  playTodoCompleteSound,
  type TodoDueReminderScope,
  type TodoReminderLeadMinutes,
} from "./todoPrefs.ts";
import { useTodoPrefs } from "./useTodoPrefs";
import "./TodoReminderSettingsSection.css";

type LeadOptionValue = `${TodoReminderLeadMinutes}`;

export function TodoReminderSettingsSection() {
  const t = useTranslation();
  const text = t.settings.todo;
  const [prefs, setPrefs] = useTodoPrefs();
  const soundSwitchId = useId();

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
      <SettingsGroup title={text.reminderGroup}>
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
      </SettingsGroup>
      <SettingsGroup title={text.wrapUpGroup}>
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
      </SettingsGroup>
      <SettingsGroup title={text.soundGroup}>
        <SettingsRow
          title={text.completionSound}
          labelFor={soundSwitchId}
          control={
            <>
              <SettingsLinkButton onClick={playTodoCompleteSound}>
                <Volume2 size={13} strokeWidth={2.2} aria-hidden="true" />
                {t.settings.sounds.preview}
              </SettingsLinkButton>
              <SettingsSwitch
                id={soundSwitchId}
                checked={prefs.completionSound}
                onChange={(completionSound) => setPrefs((current) => ({ ...current, completionSound }))}
              />
            </>
          }
        />
      </SettingsGroup>
    </>
  );
}
