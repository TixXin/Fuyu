import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ShortcutKeys } from "../../../components/controls/ShortcutKeys";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useIslandLayerShortcutProblem } from "../../../lib/island-layer/useIslandLayerShortcutProblem";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import type { IslandSettings } from "../../../lib/settings/types";
import { buildShortcutFromEvent, shortcutLabel } from "../../../lib/shortcut/shortcut";
import { useShortcutCapture } from "../../../lib/shortcut/useShortcutCapture";
import "../../../components/controls/ShortcutControl.css";

export const ISLAND_LAYER_SHORTCUT_ID = "islandLayer";

export function IslandLayerShortcutSection({ settings, onSettingsChange, takenBy }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  takenBy: (shortcut: string, selfId: string) => string | null;
}) {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  const problem = useIslandLayerShortcutProblem();
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const shortcut = settings.islandLayerShortcut;

  const apply = (next: string) => {
    const owner = next ? takenBy(next, ISLAND_LAYER_SHORTCUT_ID) : null;
    if (owner) {
      setConflict(text.taken(shortcutLabel(next), owner));
      return;
    }
    setConflict(null);
    onSettingsChange({ ...settings, islandLayerShortcut: next, islandLayerShortcutChosen: next !== "" });
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
    <SettingsGroup title={text.islandLayerTitle} footer={isMacOS ? text.islandLayerHintMac : text.islandLayerHint}>
      <div className="shortcut-row">
        <div className="shortcut-control">
          <div className="shortcut-control__meta">
            <span>{text.islandLayerToggle}</span>
            <strong>{shortcut ? shortcutLabel(shortcut) : text.islandLayerOff}</strong>
          </div>
          <div className="shortcut-control__actions">
            {shortcut && (
              <button className="shortcut-reset-button" type="button" aria-label={text.islandLayerTurnOff} onClick={() => apply("")}>
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
              <ShortcutKeys prompt={recording ? t.translator.pressShortcut : shortcut ? null : text.islandLayerSet} label={shortcutLabel(shortcut)} />
            </button>
          </div>
        </div>
        {shown && <p className="shortcut-control__error" role="alert">{shown}</p>}
      </div>
    </SettingsGroup>
  );
}
