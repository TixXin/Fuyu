import { useEffect, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { Keyboard } from "lucide-react";
import { ShortcutResetButton } from "../../components/controls/ShortcutResetButton";
import { useErrorText, useTranslation } from "../../i18n";
import { buildShortcutFromEvent, shortcutLabel } from "../clipboard/shortcut";
import { setTranslationSelectionShortcut, setTranslationShortcut } from "./api";
import { DEFAULT_SETTINGS, type TranslationSettings } from "./storage";
import "../clipboard/ClipboardSettingsSection.css";

export type TranslationShortcutTarget = "window" | "selection";

export function TranslationShortcutRows({ settings, onSettingsChange, takenBy }: {
  settings: TranslationSettings;
  onSettingsChange: Dispatch<SetStateAction<TranslationSettings>>;
  takenBy: (shortcut: string, target: TranslationShortcutTarget) => string | null;
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const [recording, setRecording] = useState<TranslationShortcutTarget | null>(null);
  const [errors, setErrors] = useState<Record<TranslationShortcutTarget, string>>({ window: "", selection: "" });
  const setError = (target: TranslationShortcutTarget, error: string) => setErrors((current) => ({ ...current, [target]: error }));

  useEffect(() => {
    let didCancel = false;
    const check = (target: TranslationShortcutTarget, register: Promise<string>) => {
      void register
        .then(() => { if (!didCancel) setError(target, ""); })
        .catch((failure) => { if (!didCancel) setError(target, errorText(failure)); });
    };
    check("window", setTranslationShortcut(settings.shortcut));
    check("selection", setTranslationSelectionShortcut(settings.selectionShortcut));
    return () => { didCancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const record = (event: KeyboardEvent<HTMLButtonElement>) => {
    const target = recording;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setRecording(null); return; }
    const shortcut = buildShortcutFromEvent(event.nativeEvent);
    if (!shortcut) return;
    setRecording(null);
    apply(target, shortcut);
  };

  const apply = (target: TranslationShortcutTarget, shortcut: string) => {
    const owner = takenBy(shortcut, target);
    if (owner) { setError(target, t.settings.shortcuts.taken(shortcutLabel(shortcut), owner)); return; }
    const register = target === "window" ? setTranslationShortcut : setTranslationSelectionShortcut;
    void register(shortcut)
      .then((registered) => {
        onSettingsChange((current) => target === "window"
          ? { ...current, shortcut: registered }
          : { ...current, selectionShortcut: registered });
        setError(target, "");
      })
      .catch((failure) => setError(target, errorText(failure)));
  };

  const rows: [TranslationShortcutTarget, string, string, string][] = [
    ["window", t.settings.shortcuts.openTranslation, settings.shortcut, DEFAULT_SETTINGS.shortcut],
    ["selection", t.settings.translation.selectionShortcut, settings.selectionShortcut, DEFAULT_SETTINGS.selectionShortcut],
  ];

  return rows.map(([target, label, value, fallback]) => (
    <div className="shortcut-row" key={target}>
      <div className="shortcut-control">
        <div className="shortcut-control__meta">
          <span>{label}</span>
          <strong>{shortcutLabel(value)}</strong>
        </div>
        <div className="shortcut-control__actions">
          <ShortcutResetButton label={t.settings.shortcuts.reset(shortcutLabel(fallback))} isDefault={value === fallback} onReset={() => apply(target, fallback)} />
          <button
            className={`shortcut-record-button${recording === target ? " shortcut-record-button--recording" : ""}`}
            type="button"
            onClick={(event) => { event.currentTarget.focus(); setRecording(target); }}
            onKeyDown={record}
            onBlur={() => setRecording((current) => (current === target ? null : current))}
          >
            <Keyboard size={14} strokeWidth={2.3} />
            <span>{recording === target ? t.translator.pressShortcut : shortcutLabel(value)}</span>
          </button>
        </div>
      </div>
      {errors[target] && <p className="shortcut-control__error" role="alert">{errors[target]}</p>}
    </div>
  ));
}
