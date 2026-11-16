import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ShortcutKeys } from "../../components/controls/ShortcutKeys";
import { ShortcutResetButton } from "../../components/controls/ShortcutResetButton";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { buildShortcutFromEvent, shortcutLabel } from "../../lib/shortcut/shortcut";
import { useShortcutCapture } from "../../lib/shortcut/useShortcutCapture";
import { DEFAULT_VOICE_SHORTCUT } from "./settings";
import { useVoiceShortcutProblem } from "./useVoiceShortcutProblem";
import "../../components/controls/ShortcutControl.css";

export function VoiceShortcutRow({ shortcut, onChange, takenBy }: {
  shortcut: string;
  onChange: (shortcut: string) => void;
  takenBy: (shortcut: string) => string | null;
}) {
  const t = useTranslation();
  const text = t.voiceInput.settings;
  const problem = useVoiceShortcutProblem();
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const apply = (next: string) => {
    const owner = next ? takenBy(next) : null;
    if (owner) {
      setConflict(t.settings.shortcuts.taken(shortcutLabel(next), owner));
      return;
    }
    setConflict(null);
    onChange(next);
  };

  useShortcutCapture(recording, (captured) => {
    setRecording(false);
    apply(captured);
  });

  const record = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setRecording(false); return; }
    const captured = buildShortcutFromEvent(event.nativeEvent);
    if (!captured) return;
    setRecording(false);
    apply(captured);
  };

  const shown = conflict ?? (problem === "invalid" && isMacOS ? text.shortcutInvalidMac : problem ? text.shortcutProblem[problem] : null);

  return (
    <div className="shortcut-row">
      <div className="shortcut-control">
        <div className="shortcut-control__meta">
          <span>{text.shortcut}</span>
          <strong>{shortcut ? shortcutLabel(shortcut) : text.shortcutOff}</strong>
        </div>
        <div className="shortcut-control__actions">
          <ShortcutResetButton label={t.settings.shortcuts.reset(shortcutLabel(DEFAULT_VOICE_SHORTCUT))} isDefault={shortcut === DEFAULT_VOICE_SHORTCUT} onReset={() => apply(DEFAULT_VOICE_SHORTCUT)} />
          {shortcut && (
            <button className="shortcut-reset-button" type="button" aria-label={text.turnOffShortcut} onClick={() => apply("")}>
              <X size={14} strokeWidth={2.3} aria-hidden="true" />
            </button>
          )}
          <button
            className={`shortcut-record-button${recording ? " shortcut-record-button--recording" : ""}`}
            type="button"
            onClick={(event) => { event.currentTarget.focus(); setRecording(true); }}
            onKeyDown={record}
            onBlur={() => setRecording(false)}
          >
            <ShortcutKeys prompt={recording ? t.translator.pressShortcut : shortcut ? null : text.setShortcut} label={shortcutLabel(shortcut)} />
          </button>
        </div>
      </div>
      {shown && <p className="shortcut-control__error" role="alert">{shown}</p>}
    </div>
  );
}
