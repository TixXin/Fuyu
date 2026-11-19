import { useRef, useState, type ChangeEvent } from "react";
import { dateKeyOf } from "./days.ts";
import { MAX_BG_FILE, MAX_BG_LENGTH, MAX_TITLE, METHODS, type CountdownItem, type CountdownKind } from "./model.ts";
import { text } from "./text.ts";

export type Invoke = (method: string, params?: unknown) => void;

type Draft = { title: string; date: string; kind: CountdownKind; repeat: boolean };

function blankDraft(): Draft {
  return { title: "", date: dateKeyOf(Date.now() + 7 * 86_400_000), kind: "countdown", repeat: false };
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="fuyu-countdown-set__seg" role="radiogroup" aria-label={label}>
      {options.map(([option, caption]) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          className={value === option ? "fuyu-countdown-set__seg-item is-on" : "fuyu-countdown-set__seg-item"}
          onClick={() => onChange(option)}
        >
          {caption}
        </button>
      ))}
    </div>
  );
}

const KINDS = [
  ["countdown", text.kindCountdown],
  ["anniversary", text.kindAnniversary],
] as const;

function BackgroundPicker({ item, invoke, onError }: { item: CountdownItem; invoke: Invoke; onError: (message: string) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BG_FILE) {
      onError(text.bgTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result && result.length <= MAX_BG_LENGTH) invoke(METHODS.setBackground, { id: item.id, backgroundDataUrl: result });
      else onError(text.bgTooLarge);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fuyu-countdown-set__line">
      <span className="fuyu-countdown-set__label">{text.background}</span>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <button type="button" className="fuyu-countdown-set__button" onClick={() => fileRef.current?.click()}>
        {text.pickBg}
      </button>
      {item.bgRev !== null && (
        <button type="button" className="fuyu-countdown-set__button" onClick={() => invoke(METHODS.setBackground, { id: item.id, backgroundDataUrl: null })}>
          {text.clearBg}
        </button>
      )}
    </div>
  );
}

export function ItemForm({
  item,
  invoke,
  onDone,
  onError,
  disabled,
}: {
  item?: CountdownItem;
  invoke: Invoke;
  onDone?: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    item ? { title: item.title, date: item.date, kind: item.kind, repeat: item.repeat } : blankDraft(),
  );
  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }));
  const ready = draft.title.trim().length > 0 && draft.date.length > 0 && !disabled;

  function submit() {
    if (!ready) return;
    if (item) {
      invoke(METHODS.update, { id: item.id, ...draft });
      onDone?.();
    } else {
      invoke(METHODS.add, draft);
      setDraft((prev) => ({ ...prev, title: "" }));
    }
  }

  return (
    <div className={item ? "fuyu-countdown-set__form is-edit" : "fuyu-countdown-set__form"}>
      <div className="fuyu-countdown-set__line">
        <input
          className="fuyu-countdown-set__input"
          value={draft.title}
          maxLength={MAX_TITLE}
          placeholder={text.titlePlaceholder}
          aria-label={text.titlePlaceholder}
          disabled={disabled}
          onChange={(e) => patch({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onDone?.();
          }}
        />
        <input
          type="date"
          className="fuyu-countdown-set__input fuyu-countdown-set__date"
          value={draft.date}
          aria-label={text.isZh ? "日期" : "Date"}
          disabled={disabled}
          onChange={(e) => patch({ date: e.target.value })}
        />
      </div>
      <div className="fuyu-countdown-set__line">
        <Segmented label={text.kind} value={draft.kind} options={KINDS} onChange={(kind) => patch({ kind })} disabled={disabled} />
        <label className="fuyu-countdown-set__check">
          <input type="checkbox" checked={draft.repeat} disabled={disabled} onChange={(e) => patch({ repeat: e.target.checked })} />
          <span>{text.repeat}</span>
        </label>
      </div>
      {item && <BackgroundPicker item={item} invoke={invoke} onError={onError} />}
      <div className="fuyu-countdown-set__line fuyu-countdown-set__actions">
        {item && (
          <button type="button" className="fuyu-countdown-set__button" onClick={onDone}>
            {text.cancel}
          </button>
        )}
        <button type="button" className="fuyu-countdown-set__button is-primary" disabled={!ready} onClick={submit}>
          {item ? text.save : text.add}
        </button>
      </div>
    </div>
  );
}
