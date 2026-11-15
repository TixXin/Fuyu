import type { ReactNode } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { VoiceInputSettings } from "./settings";
import { VoiceShortcutRow } from "./VoiceShortcutRow";

export function VoiceInputShortcutGroup({ action, settings, onSettingsChange, takenBy }: {
  action: ReactNode;
  settings: VoiceInputSettings;
  onSettingsChange: (settings: VoiceInputSettings) => void;
  takenBy: (shortcut: string) => string | null;
}) {
  const t = useTranslation();
  const text = t.voiceInput.settings;
  return (
    <SettingsGroup title={text.title} action={action} footer={settings.enabled ? text.shortcutHint : undefined}>
      {settings.enabled
        ? <VoiceShortcutRow shortcut={settings.shortcut} takenBy={takenBy} onChange={(shortcut) => onSettingsChange({ ...settings, shortcut })} />
        : (
          <SettingsRow
            searchable={false}
            title={<span className="shortcut-empty">{t.settings.shortcuts.featureOff(text.title)}</span>}
            control={<SettingsLinkButton onClick={() => onSettingsChange({ ...settings, enabled: true })}>{t.settings.shortcuts.turnOn}</SettingsLinkButton>}
          />
        )}
    </SettingsGroup>
  );
}
