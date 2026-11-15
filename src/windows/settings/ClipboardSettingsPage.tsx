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
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

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

type ClipboardTab = "clipboard" | "clipboardHistory" | "clipboardSnippets" | "clipboardData";

const sections = settingsSections<ClipboardSectionProps, ClipboardTab>();

sections.add({ id: "clipboard.general", category: "clipboard", order: 10, component: GeneralSection });
sections.add({ id: "clipboard.links", category: "clipboard", order: 20, component: LinksSection });
sections.add({ id: "clipboardHistory.record", category: "clipboardHistory", order: 10, component: RecordSection });
sections.add({ id: "clipboardSnippets.snippets", category: "clipboardSnippets", order: 10, component: ClipboardSnippetSettings });
sections.add({ id: "clipboardSnippets.ai-prompts", category: "clipboardSnippets", order: 20, component: AiPromptSection });
sections.add({ id: "clipboardData.transfer", category: "clipboardData", order: 10, component: ClipboardTransferSettings });

export function ClipboardSettingsPage({ tab, settings, onOpenShortcuts }: {
  tab: ClipboardTab;
  settings: IslandSettings;
  onOpenShortcuts: () => void;
}) {
  const t = useTranslation();
  const [clipboardSettings, updateClipboardSettings] = useClipboardSettings();
  const [translationSettings] = useTranslationSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  const openKeys = openShortcutLabel(clipboardSettings);
  const props = { onOpenShortcuts, clipboardSettings, onClipboardSettingsChange: updateClipboardSettings, takenBy };

  return (
    <>
      {tab === "clipboard" && (
        <FeatureHeader
          feature="clipboard"
          status={openKeys ? t.settings.clipboard.headerShortcut(openKeys) : undefined}
        />
      )}
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
