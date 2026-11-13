import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { ShortcutKeys } from "../../components/controls/ShortcutKeys";
import { ShortcutResetButton } from "../../components/controls/ShortcutResetButton";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { buildShortcutFromEvent, shortcutLabel } from "../clipboard/shortcut";
import { useShortcutCapture } from "../clipboard/useShortcutCapture";
import { listPlugins, setPluginKeybinding, type PluginsSnapshot } from "./api";
import { pluginShortcutRows, type PluginShortcutRow } from "./pluginShortcuts";
import "../clipboard/ClipboardSettingsSection.css";

const RECHECK_MS = 600;

export function PluginShortcutSection({ takenBy, onChanged, action, hideWhenEmpty = false }: {
  takenBy: (shortcut: string, selfId: string) => string | null;
  onChanged?: () => void;
  action?: ReactNode;
  hideWhenEmpty?: boolean;
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.shortcuts;
  const { locale } = useLocale();
  const [snapshot, setSnapshot] = useState<PluginsSnapshot | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    listPlugins()
      .then(setSnapshot)
      .catch((error: unknown) => console.error("Failed to list plugins", error));
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const save = (row: PluginShortcutRow, keybinding: string | null) => {
    if (keybinding) {
      const owner = takenBy(keybinding, row.key);
      if (owner) {
        setErrors((current) => ({ ...current, [row.key]: text.taken(shortcutLabel(keybinding), owner) }));
        return;
      }
    }
    setErrors((current) => ({ ...current, [row.key]: "" }));
    setPluginKeybinding(row.pluginId, row.commandId, keybinding)
      .then((next) => {
        setSnapshot(next);
        onChanged?.();
        window.setTimeout(refresh, RECHECK_MS);
      })
      .catch((error: unknown) => setErrors((current) => ({ ...current, [row.key]: errorText(error) })));
  };

  useShortcutCapture(recording !== null, (shortcut) => {
    const row = pluginShortcutRows(snapshot?.plugins ?? []).find((candidate) => candidate.key === recording);
    if (!row) return;
    setRecording(null);
    save(row, shortcut);
  });

  if (!snapshot) return null;
  const rows = pluginShortcutRows(snapshot.plugins);
  if (hideWhenEmpty && rows.length === 0) return null;
  const name = (row: PluginShortcutRow) => `${row.title[locale]} · ${row.pluginName[locale]}`;

  const record = (row: PluginShortcutRow, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (recording !== row.key) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setRecording(null); return; }
    const next = buildShortcutFromEvent(event.nativeEvent);
    if (!next) return;
    setRecording(null);
    save(row, next);
  };

  return (
    <SettingsGroup title={text.pluginTitle} action={action} footer={rows.length === 0 ? undefined : text.pluginHint}>
      {rows.length === 0 && <SettingsRow searchable={false} title={<span className="shortcut-empty">{text.pluginNone}</span>} />}
      {rows.map((row) => {
        const conflicts = snapshot.plugins.find((plugin) => plugin.id === row.pluginId)?.keybindingConflicts ?? [];
        const error = errors[row.key] || (row.shortcut && conflicts.includes(row.shortcut) ? text.pluginInUse : "");
        return (
          <div className="shortcut-row" key={row.key}>
            <div className="shortcut-control">
              <div className="shortcut-control__meta">
                <span>{name(row)}</span>
                <strong>{row.shortcut ? shortcutLabel(row.shortcut) : (row.changed && row.defaultShortcut ? text.pluginOff : text.pluginNotSet)}</strong>
              </div>
              <div className="shortcut-control__actions">
                <ShortcutResetButton
                  label={row.defaultShortcut ? text.reset(shortcutLabel(row.defaultShortcut)) : text.pluginClear}
                  isDefault={!row.changed}
                  onReset={() => save(row, null)}
                />
                {row.shortcut ? (
                  <button className="shortcut-reset-button" type="button" aria-label={`${text.pluginTurnOff}: ${name(row)}`} onClick={() => save(row, "")}>
                    <X size={13} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  className={`shortcut-record-button${recording === row.key ? " shortcut-record-button--recording" : ""}`}
                  type="button"
                  aria-label={`${text.pluginRecord}: ${name(row)}`}
                  onClick={(event) => { event.currentTarget.focus(); setRecording(row.key); }}
                  onKeyDown={(event) => record(row, event)}
                  onBlur={() => setRecording((current) => (current === row.key ? null : current))}
                >
                  <ShortcutKeys prompt={recording === row.key ? text.pluginPressKeys : row.shortcut ? null : text.pluginRecord} label={shortcutLabel(row.shortcut ?? "")} />
                </button>
              </div>
            </div>
            {error ? <p className="shortcut-control__error" role="alert">{error}</p> : null}
          </div>
        );
      })}
    </SettingsGroup>
  );
}
