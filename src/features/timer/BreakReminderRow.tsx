import { Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { clampMinutes, MAX_MINUTES, MAX_NAME_LENGTH, MIN_MINUTES, nextBreakIcon, type BreakReminder } from "./breakReminders";
import { REMINDER_ICONS } from "./reminderIcons";
import "./BreakReminderRow.css";

export function BreakReminderRow({ item, placeholder, onChange, onRemove }: {
  item: BreakReminder;
  placeholder: string;
  onChange: (item: BreakReminder) => void;
  onRemove: () => void;
}) {
  const t = useTranslation().timer.breaks;
  const id = useId();
  const [name, setName] = useState(item.name);
  const [minutes, setMinutes] = useState(String(item.minutes));
  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setMinutes(String(item.minutes)), [item.minutes]);
  const Icon = REMINDER_ICONS[item.icon];

  const commitName = () => {
    const next = name.trim().slice(0, MAX_NAME_LENGTH);
    setName(next);
    if (next !== item.name) onChange({ ...item, name: next });
  };
  const commitMinutes = () => {
    const next = minutes.trim() === "" ? item.minutes : clampMinutes(Number(minutes), item.minutes);
    setMinutes(String(next));
    if (next !== item.minutes) onChange({ ...item, minutes: next });
  };

  return (
    <div className="settings-row settings-row--indent break-reminder-row" data-search="off">
      <button
        className="break-reminder-row__icon"
        type="button"
        aria-label={t.changeIcon}
        title={t.changeIcon}
        onClick={() => onChange({ ...item, icon: nextBreakIcon(item.icon) })}
      >
        <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
      </button>
      <SettingsInput
        className="break-reminder-row__name"
        aria-label={t.name}
        placeholder={placeholder}
        maxLength={MAX_NAME_LENGTH}
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitName();
        }}
      />
      <span className="break-reminder-row__minutes">
        <SettingsInput
          className="settings-input--number break-reminder-row__number"
          type="number"
          inputMode="numeric"
          aria-label={t.minutes}
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          value={minutes}
          onChange={(event) => setMinutes(event.currentTarget.value)}
          onBlur={commitMinutes}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitMinutes();
          }}
        />
        <span className="settings-number__unit">{t.unit}</span>
      </span>
      <span className="break-reminder-row__end">
        <span title={t.enableItem}>
          <SettingsSwitch id={id} checked={item.enabled} onChange={(enabled) => onChange({ ...item, enabled })} />
          <label className="break-reminder-row__hidden" htmlFor={id}>{t.enableItem}</label>
        </span>
        <button className="break-reminder-row__remove" type="button" aria-label={t.remove} title={t.remove} onClick={onRemove}>
          <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
