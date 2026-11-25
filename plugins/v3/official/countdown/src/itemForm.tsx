import { useRef, useState, type ChangeEvent } from "react";
import { dateKeyOf } from "./days.ts";
import {
  LUNAR_MAX_YEAR,
  LUNAR_MIN_YEAR,
  lunarDayName,
  lunarLeapMonth,
  lunarMonthDays,
  lunarMonthName,
  lunarToSolarKey,
  solarToLunar,
  type LunarDate,
} from "./lunar.ts";
import {
  MAX_BG_FILE,
  MAX_BG_LENGTH,
  MAX_TITLE,
  METHODS,
  type CalendarKind,
  type CountdownItem,
  type CountdownKind,
} from "./model.ts";
import { text } from "./text.ts";

export type Invoke = (method: string, params?: unknown) => void;

type Draft = {
  title: string;
  date: string;
  calendar: CalendarKind;
  lunar: LunarDate;
  kind: CountdownKind;
  repeat: boolean;
};

const LUNAR_YEARS = Array.from({ length: LUNAR_MAX_YEAR - LUNAR_MIN_YEAR + 1 }, (_, i) => LUNAR_MIN_YEAR + i);

function fallbackLunar(dateKey: string): LunarDate {
  return solarToLunar(dateKey) ?? { year: new Date().getFullYear(), month: 1, day: 1 };
}

function blankDraft(): Draft {
  const date = dateKeyOf(Date.now() + 7 * 86_400_000);
  return { title: "", date, calendar: "solar", lunar: fallbackLunar(date), kind: "countdown", repeat: false };
}

function draftFromItem(item: CountdownItem): Draft {
  return {
    title: item.title,
    date: item.date,
    calendar: item.calendar ?? "solar",
    lunar: item.lunar ?? fallbackLunar(item.date),
    kind: item.kind,
    repeat: item.repeat,
  };
}

function monthOptionsFor(year: number): { value: string; month: number; leap: boolean; label: string }[] {
  const leap = lunarLeapMonth(year);
  const list: { value: string; month: number; leap: boolean; label: string }[] = [];
  for (let month = 1; month <= 12; month += 1) {
    list.push({ value: String(month), month, leap: false, label: lunarMonthName(month, false, text.isZh) });
    if (month === leap) {
      list.push({ value: `${month}L`, month, leap: true, label: lunarMonthName(month, true, text.isZh) });
    }
  }
  return list;
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

const CALENDARS = [
  ["solar", text.calendarSolar],
  ["lunar", text.calendarLunar],
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
  const [draft, setDraft] = useState<Draft>(() => (item ? draftFromItem(item) : blankDraft()));
  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }));

  function updateLunar(next: LunarDate) {
    const leap = Boolean(next.leap) && lunarLeapMonth(next.year) === next.month;
    const maxDays = lunarMonthDays(next.year, next.month, leap) || 29;
    const clamped: LunarDate = {
      year: next.year,
      month: next.month,
      day: Math.min(next.day, maxDays),
      ...(leap ? { leap: true } : {}),
    };
    const solar = lunarToSolarKey(clamped.year, clamped.month, clamped.day, leap, true);
    setDraft((prev) => ({ ...prev, lunar: clamped, ...(solar ? { date: solar } : {}) }));
  }

  function switchCalendar(calendar: CalendarKind) {
    if (calendar === draft.calendar) return;
    if (calendar === "lunar") {
      const converted = solarToLunar(draft.date);
      patch({ calendar, ...(converted ? { lunar: converted } : {}) });
    } else {
      const converted = lunarToSolarKey(draft.lunar.year, draft.lunar.month, draft.lunar.day, Boolean(draft.lunar.leap), false);
      patch({ calendar, ...(converted ? { date: converted } : {}) });
    }
  }

  const lunarSolarPreview =
    draft.calendar === "lunar"
      ? lunarToSolarKey(draft.lunar.year, draft.lunar.month, draft.lunar.day, Boolean(draft.lunar.leap), true)
      : null;
  const ready =
    draft.title.trim().length > 0 &&
    (draft.calendar === "lunar" ? lunarSolarPreview !== null : draft.date.length > 0) &&
    !disabled;

  function submit() {
    if (!ready) return;
    const payload =
      draft.calendar === "lunar"
        ? { title: draft.title, date: lunarSolarPreview!, calendar: "lunar" as const, lunar: draft.lunar, kind: draft.kind, repeat: draft.repeat }
        : { title: draft.title, date: draft.date, calendar: "solar" as const, kind: draft.kind, repeat: draft.repeat };
    if (item) {
      invoke(METHODS.update, { id: item.id, ...payload });
      onDone?.();
    } else {
      invoke(METHODS.add, payload);
      setDraft((prev) => ({ ...prev, title: "" }));
    }
  }

  const months = monthOptionsFor(draft.lunar.year);
  const maxLunarDays = lunarMonthDays(draft.lunar.year, draft.lunar.month, Boolean(draft.lunar.leap)) || 29;
  const monthValue = draft.lunar.leap ? `${draft.lunar.month}L` : String(draft.lunar.month);

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
        <Segmented label={text.calendar} value={draft.calendar} options={CALENDARS} onChange={switchCalendar} disabled={disabled} />
        {draft.calendar === "solar" && (
          <input
            type="date"
            className="fuyu-countdown-set__input fuyu-countdown-set__date"
            value={draft.date}
            aria-label={text.isZh ? "日期" : "Date"}
            disabled={disabled}
            onChange={(e) => patch({ date: e.target.value })}
          />
        )}
      </div>
      {draft.calendar === "lunar" && (
        <div className="fuyu-countdown-set__line fuyu-countdown-set__lunar">
          <select
            className="fuyu-countdown-set__select"
            aria-label={text.lunarYear}
            value={draft.lunar.year}
            disabled={disabled}
            onChange={(e) => updateLunar({ ...draft.lunar, year: Number(e.target.value) })}
          >
            {LUNAR_YEARS.map((year) => (
              <option key={year} value={year}>
                {text.isZh ? `${year}年` : year}
              </option>
            ))}
          </select>
          <select
            className="fuyu-countdown-set__select"
            aria-label={text.lunarMonth}
            value={monthValue}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value;
              const leap = raw.endsWith("L");
              const month = Number(leap ? raw.slice(0, -1) : raw);
              updateLunar({ ...draft.lunar, month, ...(leap ? { leap: true } : { leap: false }) });
            }}
          >
            {months.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="fuyu-countdown-set__select"
            aria-label={text.lunarDay}
            value={draft.lunar.day}
            disabled={disabled}
            onChange={(e) => updateLunar({ ...draft.lunar, day: Number(e.target.value) })}
          >
            {Array.from({ length: maxLunarDays }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {lunarDayName(day, text.isZh)}
              </option>
            ))}
          </select>
          {lunarSolarPreview && <span className="fuyu-countdown-set__hint">{text.solarPreview(lunarSolarPreview)}</span>}
        </div>
      )}
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
