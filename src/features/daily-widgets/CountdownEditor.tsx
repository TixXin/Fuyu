import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { clickOnly } from "../../components/island-widget/clickOnly";
import { useTranslation } from "../../i18n";
import { normalizeDateText } from "./countdowns.ts";
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

export function CountdownEditor({ at, entry, count, onEdit, onClose }: CountdownEditorProps) {
  const t = useTranslation().islandWidgets.daily;
  const [name, setName] = useState(entry?.name ?? "");
  const [date, setDate] = useState(entry?.date ?? "");
  const [tried, setTried] = useState(false);
  const normalized = normalizeDateText(date);
  const save = (): number | null => {
    if (!normalized) {
      setTried(true);
      return null;
    }
    return saveCountdown(at, { name, date: normalized });
  };
  const done = () => {
    if (!normalized && !name.trim() && at === null) onClose();
    else if (save() !== null) onClose();
  };
  const addAnother = () => {
    if (save() === null) return;
    setName("");
    setDate("");
    setTried(false);
    onEdit("new");
  };
  const keys = editorKeys(done, onClose);
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
        inputMode="numeric"
        placeholder="2027-01-01"
        aria-label={t.countdownDate}
        title={t.countdownDateHint}
        aria-invalid={tried && !normalized}
        spellCheck={false}
        onChange={(event) => setDate(event.target.value)}
        onKeyDown={keys}
      />
      <div className="daily-small daily-muted daily-editor__hint">{t.countdownDateHint}</div>
      <div className="daily-editor__buttons">
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
