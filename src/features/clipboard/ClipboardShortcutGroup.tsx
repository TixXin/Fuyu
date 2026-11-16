import type { ReactNode } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import { FeatureOffRow, type TakenBy } from "../../windows/settings/ShortcutFeatureOffRow";
import type { ClipboardHistorySettings } from "./api";
import { ClipboardShortcutRows } from "./ClipboardShortcutRows";

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
