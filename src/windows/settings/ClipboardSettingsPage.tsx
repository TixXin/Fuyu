import type { IslandSettings } from "../../features/appearance/types";
import type { ClipboardHistorySettings } from "../../features/clipboard/api";
import { ClipboardAiPromptSettings } from "../../features/clipboard/ClipboardAiPromptSettings";
import { ClipboardLinkSettings } from "../../features/clipboard/ClipboardLinkSettings";
import { ClipboardRecordSettings } from "../../features/clipboard/ClipboardRecordSettings";
import { ClipboardSettingsSection } from "../../features/clipboard/ClipboardSettingsSection";
import { ClipboardSnippetSettings } from "../../features/clipboard/ClipboardSnippetSettings";
import { ClipboardTransferSettings } from "../../features/clipboard/ClipboardTransferSettings";
import { openShortcutLabel } from "../../features/clipboard/shortcut";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";
import { ClipboardShortcutGroup } from "./ShortcutGroups";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";

type ClipboardSectionProps = {
  onOpenShortcuts: () => void;
  clipboardSettings: ClipboardHistorySettings;
  onClipboardSettingsChange: (settings: ClipboardHistorySettings) => Promise<void>;
  takenBy: ReturnType<typeof useShortcutOwners>["takenBy"];
};

function GeneralSection({ onOpenShortcuts, clipboardSettings, onClipboardSettingsChange: updateClipboardSettings, takenBy }: ClipboardSectionProps) {
  const t = useTranslation();
  return (
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
  );
}

function LinksSection({ clipboardSettings }: ClipboardSectionProps) {
  return <ClipboardLinkSettings iconsOn={clipboardSettings.linkPreview === true} />;
}

function RecordSection({ clipboardSettings, onClipboardSettingsChange: updateClipboardSettings }: ClipboardSectionProps) {
  return <ClipboardRecordSettings clipboardSettings={clipboardSettings} onChange={(patch) => updateClipboardSettings({ ...clipboardSettings, ...patch })} />;
}

function AiPromptSection({ clipboardSettings, onClipboardSettingsChange }: ClipboardSectionProps) {
  return <ClipboardAiPromptSettings clipboardSettings={clipboardSettings} onChange={onClipboardSettingsChange} />;
}

export function ClipboardSettingsPage({ tab, settings, onOpenShortcuts }: {
  tab: "clipboard" | "clipboardHistory" | "clipboardSnippets" | "clipboardData";
  settings: IslandSettings;
  onOpenShortcuts: () => void;
}) {
  const t = useTranslation();
  const [clipboardSettings, updateClipboardSettings] = useClipboardSettings();
  const [translationSettings] = useTranslationSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  const openKeys = openShortcutLabel(clipboardSettings);
  const header = (
    <FeatureHeader
      feature="clipboard"
      status={openKeys ? t.settings.clipboard.headerShortcut(openKeys) : undefined}
    />
  );
  const props = { onOpenShortcuts, clipboardSettings, onClipboardSettingsChange: updateClipboardSettings, takenBy };

  if (tab === "clipboardHistory") {
    return <RecordSection {...props} />;
  }
  if (tab === "clipboardSnippets") {
    return (
      <>
        <ClipboardSnippetSettings />
        <AiPromptSection {...props} />
      </>
    );
  }
  if (tab === "clipboardData") return <ClipboardTransferSettings />;
  return (
    <>
      {header}
      <GeneralSection {...props} />
      <LinksSection {...props} />
    </>
  );
}
