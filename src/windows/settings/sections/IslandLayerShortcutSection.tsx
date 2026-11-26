import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ShortcutKeys } from "../../../components/controls/ShortcutKeys";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useIslandExpandShortcutProblem } from "../../../lib/island-expand/useIslandExpandShortcutProblem";
import { useIslandLayerShortcutProblem } from "../../../lib/island-layer/useIslandLayerShortcutProblem";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import type { IslandSettings } from "../../../lib/settings/types";
import { buildShortcutFromEvent, shortcutLabel } from "../../../lib/shortcut/shortcut";
import { useShortcutCapture } from "../../../lib/shortcut/useShortcutCapture";
import "../../../components/controls/ShortcutControl.css";

export const ISLAND_EXPAND_SHORTCUT_ID = "islandExpand";
export const ISLAND_LAYER_SHORTCUT_ID = "islandLayer";

type IslandShortcutTarget = "expand" | "layer";

export function IslandLayerShortcutSection({ settings, onSettingsChange, takenBy }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  takenBy: (shortcut: string, selfId: string) => string | null;
}) {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  const expandProblem = useIslandExpandShortcutProblem();
  const layerProblem = useIslandLayerShortcutProblem();
  const [recording, setRecording] = useState<IslandShortcutTarget | null>(null);
  const [conflicts, setConflicts] = useState<Record<IslandShortcutTarget, string | null>>({ expand: null, layer: null });

  const apply = (target: IslandShortcutTarget, next: string) => {
    const selfId = target === "expand" ? ISLAND_EXPAND_SHORTCUT_ID : ISLAND_LAYER_SHORTCUT_ID;
    const owner = next ? takenBy(next, selfId) : null;
    if (owner) {
      setConflicts((current) => ({ ...current, [target]: text.taken(shortcutLabel(next), owner) }));
      return;
    }
    setConflicts((current) => ({ ...current, [target]: null }));
    if (target === "expand") {
      onSettingsChange({ ...settings, islandExpandShortcut: next });
      return;
    }
    onSettingsChange({ ...settings, islandLayerShortcut: next, islandLayerShortcutChosen: next !== "" });
  };

  useShortcutCapture(recording !== null, (captured) => {
    if (!recording) return;
    const target = recording;
    setRecording(null);
    apply(target, captured);
  });

  const record = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setRecording(null); return; }
    const captured = buildShortcutFromEvent(event.nativeEvent);
    if (!captured) return;
    const target = recording;
    setRecording(null);
    apply(target, captured);
  };

  const formatProblem = (problem: "invalid" | "taken" | null) =>
    problem === "invalid" && isMacOS ? text.shortcutInvalidMac : problem ? text.shortcutProblem[problem] : null;

  const rows: {
    target: IslandShortcutTarget;
    label: string;
    hint: string;
    shortcut: string;
    error: string | null;
  }[] = [
    {
      target: "expand",
      label: text.islandExpandToggle,
      hint: text.islandExpandHint,
      shortcut: settings.islandExpandShortcut,
      error: conflicts.expand ?? formatProblem(expandProblem),
    },
    {
      target: "layer",
      label: text.islandLayerToggle,
      hint: isMacOS ? text.islandLayerHintMac : text.islandLayerHint,
      shortcut: settings.islandLayerShortcut,
      error: conflicts.layer ?? formatProblem(layerProblem),
    },
  ];

  return (
    <SettingsGroup title={text.islandLayerTitle}>
      {rows.map(({ target, label, hint, shortcut, error }) => (
        <div className="shortcut-row" key={target}>
          <div className="shortcut-control">
            <div className="shortcut-control__meta">
              <span>{label}</span>
              <strong>{shortcut ? shortcutLabel(shortcut) : text.islandLayerOff}</strong>
            </div>
            <div className="shortcut-control__actions">
              {shortcut && (
                <button className="shortcut-reset-button" type="button" aria-label={text.islandLayerTurnOff} onClick={() => apply(target, "")}>
                  <X size={14} strokeWidth={2.3} aria-hidden="true" />
                </button>
              )}
              <button
                className={`shortcut-record-button${recording === target ? " shortcut-record-button--recording" : ""}`}
                type="button"
                onClick={(event) => { event.currentTarget.focus(); setRecording(target); }}
                onKeyDown={record}
                onBlur={() => setRecording((current) => (current === target ? null : current))}
              >
                <ShortcutKeys prompt={recording === target ? t.translator.pressShortcut : shortcut ? null : text.islandLayerSet} label={shortcutLabel(shortcut)} />
              </button>
            </div>
          </div>
          <p className="shortcut-control__note">{hint}</p>
          {error && <p className="shortcut-control__error" role="alert">{error}</p>}
        </div>
      ))}
    </SettingsGroup>
  );
}
