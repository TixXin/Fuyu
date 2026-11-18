import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { commandsV1, type CommandItem } from "@fuyu/plugin-services";
import { ShortcutKeys } from "../../components/controls/ShortcutKeys";
import { ShortcutResetButton } from "../../components/controls/ShortcutResetButton";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { buildShortcutFromEvent, shortcutLabel } from "../../lib/shortcut/shortcut";
import { useShortcutCapture } from "../../lib/shortcut/useShortcutCapture";
import "../../components/controls/ShortcutControl.css";

const commandsClient = windowServices.get(commandsV1);

function rowKey(item: CommandItem): string {
  return `pluginV3:${item.pluginId}/${item.id}`;
}

function pickText(map: Record<string, string> | null | undefined, locale: string, fallback: string): string {
  if (!map) return fallback;
  return map[locale] ?? map["zh-CN"] ?? map.en ?? fallback;
}

export function PluginV3ShortcutSection({
  takenBy,
  onChanged,
  action,
  hideWhenEmpty = true,
}: {
  takenBy: (shortcut: string, selfId: string) => string | null;
  onChanged?: () => void;
  action?: ReactNode;
  hideWhenEmpty?: boolean;
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.shortcuts;
  const { locale } = useLocale();
  const [items, setItems] = useState<CommandItem[] | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    commandsClient
      .list()
      .then((res) => setItems(res.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const offChanged = commandsClient.on("changed", (next) => setItems(next.items));
    const offWatch = windowServices.watch(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      void offChanged();
      offWatch();
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const rows = (items ?? []).filter((item) => item.active);

  const save = (item: CommandItem, keybinding: string | null) => {
    const key = rowKey(item);
    if (keybinding) {
      const owner = takenBy(keybinding, key);
      if (owner) {
        setErrors((current) => ({ ...current, [key]: text.taken(shortcutLabel(keybinding), owner) }));
        return;
      }
    }
    setErrors((current) => ({ ...current, [key]: "" }));
    commandsClient
      .setKeybinding({ plugin: item.pluginId, command: item.id, keybinding })
      .then((next) => {
        setItems(next.items);
        onChanged?.();
      })
      .catch((error: unknown) => setErrors((current) => ({ ...current, [key]: errorText(error) })));
  };

  useShortcutCapture(recording !== null, (shortcut) => {
    const item = rows.find((candidate) => rowKey(candidate) === recording);
    if (!item) return;
    setRecording(null);
    save(item, shortcut);
  });

  if (hideWhenEmpty && rows.length === 0) return null;
  if (!items) return null;

  const name = (item: CommandItem) => `${pickText(item.title, locale, item.id)} · ${pickText(item.pluginName, locale, item.pluginId)}`;

  const record = (item: CommandItem, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const key = rowKey(item);
    if (recording !== key) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(null);
      return;
    }
    const next = buildShortcutFromEvent(event.nativeEvent);
    if (!next) return;
    setRecording(null);
    save(item, next);
  };

  return (
    <SettingsGroup title={text.pluginV3Title} action={action} footer={rows.length === 0 ? undefined : text.pluginHint}>
      {rows.length === 0 && <SettingsRow searchable={false} title={<span className="shortcut-empty">{text.pluginNone}</span>} />}
      {rows.map((item) => {
        const key = rowKey(item);
        const changed = item.keybinding !== item.defaultKeybinding;
        const hasConflict = Boolean(item.keybinding && (item.conflicts.includes(item.keybinding) || item.conflicts.length > 0));
        const error = errors[key] || (hasConflict ? text.pluginInUse : "");
        return (
          <div className="shortcut-row" key={key}>
            <div className="shortcut-control">
              <div className="shortcut-control__meta">
                <span>{name(item)}</span>
                <strong>{item.keybinding ? shortcutLabel(item.keybinding) : changed && item.defaultKeybinding ? text.pluginOff : text.pluginNotSet}</strong>
              </div>
              <div className="shortcut-control__actions">
                <ShortcutResetButton
                  label={item.defaultKeybinding ? text.reset(shortcutLabel(item.defaultKeybinding)) : text.pluginClear}
                  isDefault={!changed}
                  onReset={() => save(item, null)}
                />
                {item.keybinding ? (
                  <button className="shortcut-reset-button" type="button" aria-label={`${text.pluginTurnOff}: ${name(item)}`} onClick={() => save(item, "")}>
                    <X size={13} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  className={`shortcut-record-button${recording === key ? " shortcut-record-button--recording" : ""}`}
                  type="button"
                  aria-label={`${text.pluginRecord}: ${name(item)}`}
                  onClick={(event) => {
                    event.currentTarget.focus();
                    setRecording(key);
                  }}
                  onKeyDown={(event) => record(item, event)}
                  onBlur={() => setRecording((current) => (current === key ? null : current))}
                >
                  <ShortcutKeys prompt={recording === key ? text.pluginPressKeys : item.keybinding ? null : text.pluginRecord} label={shortcutLabel(item.keybinding ?? "")} />
                </button>
              </div>
            </div>
            {error ? (
              <p className="shortcut-control__error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </SettingsGroup>
  );
}
