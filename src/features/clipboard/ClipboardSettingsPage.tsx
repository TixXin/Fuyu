import type { IslandSettings } from "../../lib/settings/types";
import type { ClipboardHistorySettings } from "./api";
import { ClipboardAiPromptSettings } from "./ClipboardAiPromptSettings";
import { ClipboardLinkSettings } from "./ClipboardLinkSettings";
import { ClipboardRecordSettings } from "./ClipboardRecordSettings";
import { ClipboardSettingsSection } from "./ClipboardSettingsSection";
import { ClipboardSnippetSettings } from "./ClipboardSnippetSettings";
import { ClipboardTransferSettings } from "./ClipboardTransferSettings";
import { openShortcutLabel } from "./shortcut";
import { useClipboardSettings } from "./useClipboardSettings";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "../../windows/settings/FeatureHeader";
import { ClipboardShortcutGroup } from "./ClipboardShortcutGroup";
import { AllShortcutsLink } from "../../windows/settings/ShortcutsSettingsPage";
import { useShortcutOwners } from "../../windows/settings/useShortcutOwners";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../../windows/settings/slots/sectionSlot";

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
  const { takenBy } = useShortcutOwners(settings);
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
