import type { IslandSettings } from "../../features/appearance/types";
import { ClipboardAiPromptSettings } from "../../features/clipboard/ClipboardAiPromptSettings";
import { ClipboardSettingsSection } from "../../features/clipboard/ClipboardSettingsSection";
import { ClipboardSnippetSettings } from "../../features/clipboard/ClipboardSnippetSettings";
import { ClipboardTransferSettings } from "../../features/clipboard/ClipboardTransferSettings";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { useTranslation } from "../../i18n";
import { ModuleSwitchSection } from "./ModuleSwitchSection";
import { ClipboardShortcutGroup } from "./ShortcutGroups";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";

export function ClipboardSettingsPage({ settings, onOpenShortcuts }: { settings: IslandSettings; onOpenShortcuts: () => void }) {
  const t = useTranslation();
  const [clipboardSettings, updateClipboardSettings] = useClipboardSettings();
  const [translationSettings] = useTranslationSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });

  return (
    <>
      <ModuleSwitchSection
        label={t.settings.modules.clipboard}
        checked={clipboardSettings.enabled}
        onChange={(enabled) => updateClipboardSettings({ ...clipboardSettings, enabled })}
      />
      {clipboardSettings.enabled && (
        <ClipboardSettingsSection
          clipboardSettings={clipboardSettings}
          onClipboardSettingsChange={updateClipboardSettings}
          shortcuts={
            <ClipboardShortcutGroup
              title={t.settings.shortcuts.featureTitle}
              action={<AllShortcutsLink onOpen={onOpenShortcuts} />}
              clipboard={clipboardSettings}
              onClipboardChange={updateClipboardSettings}
              takenBy={takenBy}
            />
          }
        />
      )}
      {clipboardSettings.enabled && <ClipboardSnippetSettings />}
      {clipboardSettings.enabled && <ClipboardAiPromptSettings clipboardSettings={clipboardSettings} onChange={updateClipboardSettings} />}
      {clipboardSettings.enabled && <ClipboardTransferSettings />}
    </>
  );
}
