import { useState, type KeyboardEvent } from "react";
import { ShortcutKeys } from "../../components/controls/ShortcutKeys";
import { buildShortcutFromEvent, shortcutLabel } from "../../features/clipboard/shortcut";
import { useShortcutCapture } from "../../features/clipboard/useShortcutCapture";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { SettingsCategory } from "./categories";
import { findShortcutOwnerRow, type ShortcutOwner } from "./shortcutConflicts";

export function ShortcutFinder({ owners, onOpenPage }: {
  owners: readonly ShortcutOwner[];
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  const [recording, setRecording] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const owner = pressed ? findShortcutOwnerRow(pressed, owners, "") : undefined;

  useShortcutCapture(recording, (shortcut) => {
    setRecording(false);
    setPressed(shortcut);
  });

  const record = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setRecording(false); return; }
    const shortcut = buildShortcutFromEvent(event.nativeEvent);
    if (!shortcut) return;
    setRecording(false);
    setPressed(shortcut);
  };

  const result = !pressed ? null : owner ? (
    <span className="shortcut-finder__result" role="status">
      {text.finderUsed(shortcutLabel(pressed), owner.label, owner.home ? t.settings.categories[owner.home] : text.featureTitle)}
      {owner.home ? <SettingsLinkButton onClick={() => owner.home && onOpenPage(owner.home)}>{text.finderOpen}</SettingsLinkButton> : null}
    </span>
  ) : (
    <span className="shortcut-finder__result shortcut-finder__result--free" role="status">{text.finderFree(shortcutLabel(pressed))}</span>
  );

  return (
    <SettingsGroup footer={result}>
      <SettingsRow
        title={text.finderTitle}
        description={text.finderDescription}
        control={
          <button
            className={`shortcut-record-button${recording ? " shortcut-record-button--recording" : ""}`}
            type="button"
            aria-label={text.finderTitle}
            onClick={(event) => { event.currentTarget.focus(); setRecording(true); }}
            onKeyDown={record}
            onBlur={() => setRecording(false)}
          >
            <ShortcutKeys prompt={recording ? text.finderPress : pressed ? null : text.finderIdle} label={shortcutLabel(pressed ?? "")} />
          </button>
        }
      />
    </SettingsGroup>
  );
}
