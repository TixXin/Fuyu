import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Keyboard, X } from "lucide-react";
import { ShortcutResetButton } from "../../components/controls/ShortcutResetButton";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { buildShortcutFromEvent } from "../clipboard/shortcut";
import { listPlugins, setPluginKeybinding, type PluginsSnapshot } from "./api";
import { pluginShortcutRows, type PluginShortcutRow } from "./pluginShortcuts";
import "../clipboard/ClipboardSettingsSection.css";

/** Registration happens after saving; read the conflicts again once it has. */
const RECHECK_MS = 600;

/**
 * The global shortcuts of the plugins that are on, on the Shortcuts and Plugins pages. Each
 * command can get a shortcut of the user's choice, be turned off, or go back to the one its
 * manifest declares. `takenBy` refuses keys any other shortcut (the island's or another
 * plugin's) uses; `onChanged` tells its owner list that a plugin's keys changed.
 */
export function PluginShortcutSection({ takenBy, onChanged, action, hideWhenEmpty = false }: {
  takenBy: (shortcut: string, selfId: string) => string | null;
  onChanged?: () => void;
  action?: ReactNode;
  /** On the Plugins page a group saying there is nothing would only be in the way. */
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

  if (!snapshot) return null;
  const rows = pluginShortcutRows(snapshot.plugins);
  if (hideWhenEmpty && rows.length === 0) return null;
  const name = (row: PluginShortcutRow) => `${row.title[locale]} · ${row.pluginName[locale]}`;

  const save = (row: PluginShortcutRow, keybinding: string | null) => {
    if (keybinding) {
      const owner = takenBy(keybinding, row.key);
      if (owner) {
        setErrors((current) => ({ ...current, [row.key]: text.taken(keybinding, owner) }));
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
                <strong>{row.shortcut ?? (row.changed && row.defaultShortcut ? text.pluginOff : text.pluginNotSet)}</strong>
              </div>
              <div className="shortcut-control__actions">
                <ShortcutResetButton
                  label={row.defaultShortcut ? text.reset(row.defaultShortcut) : text.pluginClear}
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
                  onClick={() => setRecording(row.key)}
                  onKeyDown={(event) => record(row, event)}
                  onBlur={() => setRecording((current) => (current === row.key ? null : current))}
                >
                  <Keyboard size={14} strokeWidth={2.3} />
                  <span>{recording === row.key ? text.pluginPressKeys : row.shortcut ?? text.pluginRecord}</span>
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
