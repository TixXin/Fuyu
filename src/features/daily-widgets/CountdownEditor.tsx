import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { clickOnly } from "../../components/island-widget/clickOnly";
import { useLocale, useTranslation } from "../../i18n";
import {
  convertDateBetweenCalendars,
  countdownTarget,
  formatCountdownLunar,
  normalizeDateText,
  normalizeLunarDateText,
  type CountdownCalendar,
} from "./countdowns.ts";
import { MAX_COUNTDOWNS, type CountdownEntry } from "./dailyFormat.ts";
import { removeCountdown, saveCountdown } from "./customize.ts";
import { editorKeys, stopPointer } from "./inputGuards.ts";

type CountdownEditorProps = {
  at: number | null;
  entry: CountdownEntry | null;
  count: number;
  onEdit: (at: number | "new") => void;
  onClose: () => void;
};

function initialDateText(entry: CountdownEntry | null): string {
  if (!entry) return "";
  if (entry.calendar !== "lunar" || !entry.leap) return entry.date;
  const parts = entry.date.split("-");
  return parts.length === 3 ? `${parts[0]}-闰${parts[1]}-${parts[2]}` : `闰${entry.date}`;
}

export function CountdownEditor({ at, entry, count, onEdit, onClose }: CountdownEditorProps) {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const [name, setName] = useState(entry?.name ?? "");
  const [calendar, setCalendar] = useState<CountdownCalendar>(entry?.calendar ?? "solar");
  const [date, setDate] = useState(() => initialDateText(entry));
  const [tried, setTried] = useState(false);
  const solarNormalized = calendar === "solar" ? normalizeDateText(date) : null;
  const lunarNormalized = calendar === "lunar" ? normalizeLunarDateText(date) : null;
  const valid = calendar === "lunar" ? lunarNormalized !== null : solarNormalized !== null;
  const switchCalendar = (next: CountdownCalendar) => {
    if (next === calendar) return;
    const converted = convertDateBetweenCalendars(date, calendar, next, new Date());
    setCalendar(next);
    if (converted !== null) setDate(converted);
    setTried(false);
  };
  const save = (): number | null => {
    if (calendar === "lunar") {
      if (!lunarNormalized) {
        setTried(true);
        return null;
      }
      return saveCountdown(at, {
        name,
        date: lunarNormalized.date,
        calendar: "lunar",
        ...(lunarNormalized.leap ? { leap: true } : {}),
      });
    }
    if (!solarNormalized) {
      setTried(true);
      return null;
    }
    return saveCountdown(at, { name, date: solarNormalized });
  };
  const done = () => {
    if (!valid && !name.trim() && at === null) onClose();
    else if (save() !== null) onClose();
  };
  const addAnother = () => {
    if (save() === null) return;
    setName("");
    setDate("");
    setCalendar("solar");
    setTried(false);
    onEdit("new");
  };
  const keys = editorKeys(done, onClose);
  const lunarPreview =
    calendar === "lunar" && lunarNormalized
      ? (() => {
          const target = countdownTarget(
            { date: lunarNormalized.date, calendar: "lunar", leap: lunarNormalized.leap },
            new Date(),
          );
          const lunarLabel = formatCountdownLunar(lunarNormalized.date, lunarNormalized.leap, locale);
          const solarText = target.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
          return lunarLabel ? `${t.countdownLunarPrefix}${lunarLabel} · ${solarText}` : solarText;
        })()
      : null;
  const hint = calendar === "lunar" ? (lunarPreview ?? t.countdownLunarHint) : t.countdownDateHint;
  return (
    <div className="island-widget daily-countdown daily-editor" onPointerDown={stopPointer}>
      <input
        className="daily-input"
        value={name}
        maxLength={24}
        placeholder={t.countdownNamePlaceholder}
        aria-label={t.countdownName}
        autoFocus
        spellCheck={false}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={keys}
      />
      <input
        className="daily-input"
        value={date}
        inputMode={calendar === "lunar" ? "text" : "numeric"}
        placeholder={calendar === "lunar" ? t.countdownLunarPlaceholder : "2027-01-01"}
        aria-label={t.countdownDate}
        title={hint}
        aria-invalid={tried && !valid}
        spellCheck={false}
        onChange={(event) => setDate(event.target.value)}
        onKeyDown={keys}
      />
      <div className="daily-small daily-muted daily-editor__hint" title={hint}>
        {hint}
      </div>
      <div className="daily-editor__buttons">
        <div className="daily-editor__cal" role="radiogroup" aria-label={t.countdownCalendarLabel}>
          <button
            className="daily-editor__cal-btn"
            type="button"
            role="radio"
            aria-checked={calendar === "solar"}
            onClick={clickOnly(() => switchCalendar("solar"))}
          >
            {t.countdownSolar}
          </button>
          <button
            className="daily-editor__cal-btn"
            type="button"
            role="radio"
            aria-checked={calendar === "lunar"}
            onClick={clickOnly(() => switchCalendar("lunar"))}
          >
            {t.countdownLunar}
          </button>
        </div>
        {at !== null ? (
          <button
            className="daily-button daily-button--plain"
            type="button"
            aria-label={t.remove}
            title={t.remove}
            onClick={clickOnly(() => {
              removeCountdown(at);
              onClose();
            })}
          >
            <Trash2 size={11} strokeWidth={2.4} />
          </button>
        ) : null}
        {count < MAX_COUNTDOWNS && (at !== null || count < MAX_COUNTDOWNS - 1) ? (
          <button className="daily-button daily-button--plain" type="button" aria-label={t.addCountdown} title={t.addCountdown} onClick={clickOnly(addAnother)}>
            <Plus size={12} strokeWidth={2.4} />
          </button>
        ) : null}
        <button className="daily-button" type="button" aria-label={t.done} title={t.done} onClick={clickOnly(done)}>
          <Check size={12} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
