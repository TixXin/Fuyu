import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { ClipboardHistorySettings } from "../../features/clipboard/api";
import { ClipboardShortcutRows } from "../../features/clipboard/ClipboardShortcutRows";
import type { TranslationSettings } from "../../features/translation/storage";
import { TranslationShortcutRows } from "../../features/translation/TranslationShortcutRows";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import "./ShortcutsSettingsPage.css";

type TakenBy = (shortcut: string, selfId: string) => string | null;

/** Stands in for the recorders of a feature that is off, on the Shortcuts page. */
function FeatureOffRow({ feature, onTurnOn }: { feature: string; onTurnOn: () => void }) {
  const t = useTranslation();
  return (
    <SettingsRow
      searchable={false}
      title={<span className="shortcut-empty">{t.settings.shortcuts.featureOff(feature)}</span>}
      control={<SettingsLinkButton onClick={onTurnOn}>{t.settings.shortcuts.turnOn}</SettingsLinkButton>}
    />
  );
}

/**
 * The two global translation shortcuts as one group, the same on the Translation page and the
 * Shortcuts page: both edit the one saved copy, so a change on either shows on the other.
 * `onTurnOn` (Shortcuts page only) keeps the group when translation is off.
 */
export function TranslationShortcutGroup({ title, action, enabled, translation, onTranslationChange, takenBy, onTurnOn }: {
  title: string;
  action: ReactNode;
  enabled: boolean;
  translation: TranslationSettings;
  onTranslationChange: Dispatch<SetStateAction<TranslationSettings>>;
  takenBy: TakenBy;
  onTurnOn?: () => void;
}) {
  const t = useTranslation();
  if (!enabled && !onTurnOn) return null;
  return (
    <SettingsGroup
      title={title}
      action={action}
      // On the Shortcuts page the clipboard group below already says what a global shortcut is.
      footer={!enabled ? undefined : onTurnOn ? t.settings.translation.selectionShortcutHint : `${t.settings.shortcuts.globalHint} ${t.settings.translation.selectionShortcutHint}`}
    >
      {enabled
        ? <TranslationShortcutRows settings={translation} onSettingsChange={onTranslationChange} takenBy={takenBy} />
        : onTurnOn && <FeatureOffRow feature={t.settings.categories.translation} onTurnOn={onTurnOn} />}
    </SettingsGroup>
  );
}

/** The clipboard history shortcut (its switch, the keys, Win+V) as one group; see TranslationShortcutGroup. */
export function ClipboardShortcutGroup({ title, action, clipboard, onClipboardChange, takenBy, onTurnOn }: {
  title: string;
  action: ReactNode;
  clipboard: ClipboardHistorySettings;
  onClipboardChange: (settings: ClipboardHistorySettings) => void;
  takenBy: TakenBy;
  onTurnOn?: () => void;
}) {
  const t = useTranslation();
  if (!clipboard.enabled && !onTurnOn) return null;
  return (
    <SettingsGroup title={title} action={action} footer={clipboard.enabled ? t.settings.shortcuts.globalHint : undefined}>
      {clipboard.enabled
        ? <ClipboardShortcutRows clipboardSettings={clipboard} onClipboardSettingsChange={onClipboardChange} takenBy={(shortcut) => takenBy(shortcut, "clipboard")} />
        : onTurnOn && <FeatureOffRow feature={t.settings.categories.clipboard} onTurnOn={onTurnOn} />}
    </SettingsGroup>
  );
}
