import { useState, type KeyboardEvent } from "react";
import { Keyboard, X } from "lucide-react";
import { ShortcutResetButton } from "../../components/controls/ShortcutResetButton";
import { useTranslation } from "../../i18n";
import { buildShortcutFromEvent } from "../clipboard/shortcut";
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, type ScreenshotSettings, type ShortcutAction } from "./settings";
import { useShortcutStatus } from "./useShortcutStatus";
import "../clipboard/ClipboardSettingsSection.css";
import "./ScreenshotShortcutRows.css";

export function ScreenshotShortcutRows({ settings, onSettingsChange, takenBy }: {
  settings: ScreenshotSettings;
  onSettingsChange: (settings: ScreenshotSettings) => void;
  takenBy: (shortcut: string, action: ShortcutAction) => string | null;
}) {
  const t = useTranslation();
  const text = t.settings.screenshot;
  const status = useShortcutStatus();
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [conflict, setConflict] = useState<{ action: ShortcutAction; message: string } | null>(null);

  const apply = (action: ShortcutAction, shortcut: string) => {
    const owner = shortcut ? takenBy(shortcut, action) : null;
    if (owner) {
      setConflict({ action, message: t.settings.shortcuts.taken(shortcut, owner) });
      return;
    }
    setConflict(null);
    onSettingsChange({ ...settings, shortcuts: { ...settings.shortcuts, [action]: shortcut } });
  };

  const record = (event: KeyboardEvent<HTMLButtonElement>) => {
    const action = recording;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setRecording(null); return; }
    const shortcut = buildShortcutFromEvent(event.nativeEvent);
    if (!shortcut) return;
    setRecording(null);
    apply(action, shortcut);
  };

  const problemOf = (action: ShortcutAction) => {
    if (conflict?.action === action) return conflict.message;
    const found = status.find((entry) => entry.action === action);
    return found ? text.shortcutProblem[found.problem] : "";
  };

  return SHORTCUT_ACTIONS.map((action) => {
    const value = settings.shortcuts[action];
    const fallback = DEFAULT_SHORTCUTS[action];
    const problem = problemOf(action);
    return (
      <div className="shortcut-row" key={action}>
        <div className="shortcut-control">
          <div className="shortcut-control__meta">
            <span>{text.actions[action]}</span>
            <strong>{value || text.shortcutOff}</strong>
          </div>
          <div className="shortcut-control__actions">
            {fallback && <ShortcutResetButton label={t.settings.shortcuts.reset(fallback)} isDefault={value === fallback} onReset={() => apply(action, fallback)} />}
            {value && (
              <button className="shortcut-reset-button" type="button" aria-label={text.turnOffShortcut(text.actions[action])} onClick={() => apply(action, "")}>
                <X size={14} strokeWidth={2.3} aria-hidden="true" />
              </button>
            )}
            <button
              className={`shortcut-record-button${recording === action ? " shortcut-record-button--recording" : ""}`}
              type="button"
              onClick={() => setRecording(action)}
              onKeyDown={record}
              onBlur={() => setRecording((current) => (current === action ? null : current))}
            >
              <Keyboard size={14} strokeWidth={2.3} aria-hidden="true" />
              <span>{recording === action ? t.translator.pressShortcut : value || text.setShortcut}</span>
            </button>
          </div>
        </div>
        <p className="screenshot-shortcut-hint">{text.actionHints[action]}</p>
        {problem && <p className="shortcut-control__error" role="alert">{problem}</p>}
      </div>
    );
  });
}
