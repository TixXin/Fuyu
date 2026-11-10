import { ClipboardSettingsSection } from "../../features/clipboard/ClipboardSettingsSection";
import { ClipboardSnippetSettings } from "../../features/clipboard/ClipboardSnippetSettings";
import { ClipboardTransferSettings } from "../../features/clipboard/ClipboardTransferSettings";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslation } from "../../i18n";
import { ModuleSwitchSection } from "./ModuleSwitchSection";
import { ShortcutsLinkSection } from "./ShortcutsSettingsPage";

/** Settings → Clipboard. Its page on the island has the panel's size like every page (C27). */
export function ClipboardSettingsPage({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const t = useTranslation();
  const [clipboardSettings, updateClipboardSettings] = useClipboardSettings();

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
        />
      )}
      {clipboardSettings.enabled && <ClipboardSnippetSettings />}
      {clipboardSettings.enabled && <ClipboardTransferSettings />}
      {clipboardSettings.enabled && <ShortcutsLinkSection onOpen={onOpenShortcuts} />}
    </>
  );
}
