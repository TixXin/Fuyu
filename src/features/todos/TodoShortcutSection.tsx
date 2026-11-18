import { useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { ShortcutKeys } from "../../components/controls/ShortcutKeys";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { buildShortcutFromEvent, shortcutLabel } from "../../lib/shortcut/shortcut";
import { useShortcutCapture } from "../../lib/shortcut/useShortcutCapture";
import { SUGGESTED_TODO_SHORTCUT, useTodoQuickAddShortcut, useTodoShortcutProblem } from "./useTodoShortcut";
import "../../components/controls/ShortcutControl.css";

export function TodoShortcutSection({
  title,
  action,
  enabled = true,
  takenBy,
  onTurnOn,
}: {
  title?: string;
  action?: ReactNode;
  enabled?: boolean;
  takenBy: (shortcut: string) => string | null;
  onTurnOn?: () => void;
}) {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  const [shortcut, setShortcut] = useTodoQuickAddShortcut();
  const problem = useTodoShortcutProblem();
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const apply = (next: string) => {
    const owner = next ? takenBy(next) : null;
    if (owner) {
      setConflict(text.taken(shortcutLabel(next), owner));
      return;
    }
    setConflict(null);
    setShortcut(next);
  };

  useShortcutCapture(recording, (captured) => {
    setRecording(false);
    apply(captured);
  });

  const record = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(false);
      return;
    }
    const captured = buildShortcutFromEvent(event.nativeEvent);
    if (!captured) return;
    setRecording(false);
    apply(captured);
  };

  const shown = conflict ?? (problem === "invalid" && isMacOS ? text.shortcutInvalidMac : problem ? text.shortcutProblem[problem] : null);
  const groupTitle = title ?? text.featureTitle;

  return (
    <SettingsGroup title={groupTitle} action={action} footer={enabled ? text.todoQuickAddHint(shortcutLabel(SUGGESTED_TODO_SHORTCUT)) : undefined}>
      {enabled ? (
        <div className="shortcut-row">
          <div className="shortcut-control">
            <div className="shortcut-control__meta">
              <span>{text.todoQuickAdd}</span>
              <strong>{shortcut ? shortcutLabel(shortcut) : text.pluginNotSet}</strong>
            </div>
            <div className="shortcut-control__actions">
              {shortcut && (
                <button className="shortcut-reset-button" type="button" aria-label={text.pluginClear} onClick={() => apply("")}>
                  <X size={14} strokeWidth={2.3} aria-hidden="true" />
                </button>
              )}
              <button
                className={`shortcut-record-button${recording ? " shortcut-record-button--recording" : ""}`}
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  setRecording(true);
                }}
                onKeyDown={record}
                onBlur={() => setRecording(false)}
              >
                <ShortcutKeys prompt={recording ? t.translator.pressShortcut : shortcut ? null : text.pluginRecord} label={shortcutLabel(shortcut)} />
              </button>
            </div>
          </div>
          {shown && <p className="shortcut-control__error" role="alert">{shown}</p>}
        </div>
      ) : (
        <SettingsRow
          searchable={false}
          title={<span className="shortcut-empty">{text.featureOff(t.settings.categories.todos)}</span>}
          control={onTurnOn ? <SettingsLinkButton onClick={onTurnOn}>{text.turnOn}</SettingsLinkButton> : undefined}
        />
      )}
    </SettingsGroup>
  );
}
