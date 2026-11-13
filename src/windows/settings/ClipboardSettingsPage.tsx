import type { IslandSettings } from "../../features/appearance/types";
import { ClipboardAiPromptSettings } from "../../features/clipboard/ClipboardAiPromptSettings";
import { ClipboardRecordSettings } from "../../features/clipboard/ClipboardRecordSettings";
import { ClipboardSettingsSection } from "../../features/clipboard/ClipboardSettingsSection";
import { ClipboardSnippetSettings } from "../../features/clipboard/ClipboardSnippetSettings";
import { ClipboardTransferSettings } from "../../features/clipboard/ClipboardTransferSettings";
import { shortcutLabel } from "../../features/clipboard/shortcut";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";
import { ClipboardShortcutGroup } from "./ShortcutGroups";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";

export function ClipboardSettingsPage({ tab, settings, onOpenShortcuts }: {
  tab: "clipboard" | "clipboardHistory" | "clipboardSnippets" | "clipboardData";
  settings: IslandSettings;
  onOpenShortcuts: () => void;
}) {
  const t = useTranslation();
  const [clipboardSettings, updateClipboardSettings] = useClipboardSettings();
  const [translationSettings] = useTranslationSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  const header = (
    <FeatureHeader
      feature="clipboard"
      checked={clipboardSettings.enabled}
      status={clipboardSettings.shortcutEnabled ? t.settings.clipboard.headerShortcut(shortcutLabel(clipboardSettings.shortcut)) : undefined}
      onChange={(enabled) => updateClipboardSettings({ ...clipboardSettings, enabled })}
    />
  );

  if (!clipboardSettings.enabled) return header;
  if (tab === "clipboardHistory") {
    return <ClipboardRecordSettings clipboardSettings={clipboardSettings} onChange={(patch) => updateClipboardSettings({ ...clipboardSettings, ...patch })} />;
  }
  if (tab === "clipboardSnippets") {
    return (
      <>
        <ClipboardSnippetSettings />
        <ClipboardAiPromptSettings clipboardSettings={clipboardSettings} onChange={updateClipboardSettings} />
      </>
    );
  }
  if (tab === "clipboardData") return <ClipboardTransferSettings />;
  return (
    <>
      {header}
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
    </>
  );
}
