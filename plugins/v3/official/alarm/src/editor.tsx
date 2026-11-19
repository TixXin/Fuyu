import { useState } from "react";
import { ALARM_TONES, type AlarmDraft, type AlarmTone } from "./model.ts";
import { text } from "./text.ts";

type DraftPatch = (patch: Partial<AlarmDraft>) => void;

export function DraftOptions({ draft, order, patch }: { draft: AlarmDraft; order: readonly number[]; patch: DraftPatch }) {
  const toggleDay = (day: number) =>
    patch({ days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day].sort((a, b) => a - b) });
  return (
    <div className="fuyu-alarm__options">
      <div className="fuyu-alarm__days" role="group" aria-label={text.repeat}>
        {order.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={draft.days.includes(day)}
            className={draft.days.includes(day) ? "fuyu-alarm__day fuyu-alarm__day--on" : "fuyu-alarm__day"}
            onClick={() => toggleDay(day)}
          >
            {text.weekdays[day]}
          </button>
        ))}
      </div>
      <select
        className="fuyu-alarm__select"
        aria-label={text.tone}
        value={draft.tone}
        onChange={(e) => patch({ tone: e.target.value as AlarmTone })}
      >
        {ALARM_TONES.map((tone) => (
          <option key={tone} value={tone}>
            {text.tones[tone]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TimeAndLabel({ draft, patch }: { draft: AlarmDraft; patch: DraftPatch }) {
  return (
    <>
      <input
        type="time"
        className="fuyu-alarm__time-input"
        aria-label={text.title}
        value={draft.time}
        onChange={(e) => patch({ time: e.target.value })}
      />
      <input
        type="text"
        className="fuyu-alarm__input"
        placeholder={text.labelPlaceholder}
        maxLength={60}
        value={draft.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
    </>
  );
}

export function AlarmEditor({
  initial,
  order,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: AlarmDraft;
  order: readonly number[];
  onSave: (draft: AlarmDraft) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<AlarmDraft>(initial);
  const patch: DraftPatch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  return (
    <div className="fuyu-alarm__editor">
      <div className="fuyu-alarm__form-top">
        <TimeAndLabel draft={draft} patch={patch} />
      </div>
      <DraftOptions draft={draft} order={order} patch={patch} />
      <div className="fuyu-alarm__editor-actions">
        <button type="button" className="fuyu-alarm__mini fuyu-alarm__mini--danger" onClick={onDelete}>
          {text.remove}
        </button>
        <span className="fuyu-alarm__spacer" />
        <button type="button" className="fuyu-alarm__mini" onClick={onCancel}>
          {text.cancel}
        </button>
        <button type="button" className="fuyu-alarm__button" disabled={!draft.time} onClick={() => onSave({ ...draft, label: draft.label.trim() })}>
          {text.save}
        </button>
      </div>
    </div>
  );
}
