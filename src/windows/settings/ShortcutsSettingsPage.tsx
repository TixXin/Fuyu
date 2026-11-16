import type { Dispatch, ReactNode, SetStateAction } from "react";
import { PageShortcutSection } from "./sections/PageShortcutSection";
import type { IslandSettings } from "../../lib/settings/types";
import { APPROVAL_HOTKEYS } from "../../features/agent-status/approvals/api";
import { approvalLabel } from "../../features/agent-status/approvals/approvalLabel";
import type { ClipboardHistorySettings } from "../../features/clipboard/api";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { PluginShortcutSection } from "../../features/plugins/PluginShortcutSection";
import type { ScreenshotSettings } from "../../features/screenshot/settings";
import type { TranslationSettings } from "../../features/translation/storage";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import type { VoiceInputSettings } from "../../features/voice-input/settings";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { ShortcutKeys } from "../../components/controls/ShortcutKeys";
import { useTranslation, type Translations } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { SettingsCategory } from "./categories";
import { ShortcutFinder } from "./ShortcutFinder";
import { useScreenshotSettings } from "../../features/screenshot/useScreenshotSettings";
import { VoiceInputShortcutGroup } from "../../features/voice-input/VoiceInputShortcutGroup";
import { useVoiceInputSettings } from "../../features/voice-input/useVoiceInputSettings";
import { ClipboardShortcutGroup, ScreenshotShortcutGroup, TranslationShortcutGroup } from "./ShortcutGroups";
import { useShortcutOwners } from "./useShortcutOwners";
import "./ShortcutsSettingsPage.css";
import { shortcutLabel } from "../../lib/shortcut/shortcut";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

type ShortcutsSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPage: (page: SettingsCategory) => void;
  takenBy: ReturnType<typeof useShortcutOwners>["takenBy"];
  refreshPlugins: () => void;
  clipboard: ClipboardHistorySettings;
  onClipboardChange: (settings: ClipboardHistorySettings) => Promise<void>;
  translation: TranslationSettings;
  onTranslationChange: Dispatch<SetStateAction<TranslationSettings>>;
  screenshot: ScreenshotSettings;
  onScreenshotChange: Dispatch<SetStateAction<ScreenshotSettings>>;
  voice: VoiceInputSettings;
  onVoiceChange: ReturnType<typeof useVoiceInputSettings>[1];
};

function ReferenceSection({ title, rows, footer, action }: { title: string; rows: [string, string][]; footer?: string; action?: ReactNode }) {
  return (
    <SettingsGroup title={title} footer={footer} action={action}>
      {rows.map(([label, keys]) => (
        <SettingsRow key={label} title={label} control={<ShortcutKeys label={keys} />} />
      ))}
    </SettingsGroup>
  );
}

function pageLink(t: Translations, onOpenPage: (page: SettingsCategory) => void, page: SettingsCategory) {
  return <SettingsLinkButton onClick={() => onOpenPage(page)}>{t.settings.shortcuts.openFeaturePage}</SettingsLinkButton>;
}

function PageKeysSection({ settings, onSettingsChange, takenBy }: ShortcutsSectionProps) {
  return <PageShortcutSection settings={settings} onSettingsChange={onSettingsChange} takenBy={takenBy} />;
}

function ReferenceSheetSection({ settings, onOpenPage }: ShortcutsSectionProps) {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  return (
    <div className="shortcut-sheet">
      <ReferenceSection
        title={text.islandTitle}
        rows={[[text.collapse, "Esc"], [text.moveIsland, isMacOS ? text.altDragMac : text.altDrag], [isMacOS ? text.resizePanelMac : text.resizePanel, isMacOS ? text.altDragEdgeMac : text.altDragEdge]]}
      />
      {settings.translationEnabled && (
        <ReferenceSection
          title={text.inputTitle}
          rows={[[text.translate, "Enter"], [text.newLine, "Shift + Enter"], [text.pasteClipboard, "Tab"]]}
        />
      )}
      <ReferenceSection
        title={text.approvalTitle}
        rows={APPROVAL_HOTKEYS.map(({ action, shortcut }) => [approvalLabel(t, action), shortcutLabel(shortcut)])}
        footer={text.approvalHint}
        action={pageLink(t, onOpenPage, "agentApprovals")}
      />
    </div>
  );
}

function TranslationSection({ settings, onSettingsChange, onOpenPage, takenBy, translation, onTranslationChange }: ShortcutsSectionProps) {
  const t = useTranslation();
  return (
    <TranslationShortcutGroup
      title={t.settings.categories.translation}
      action={pageLink(t, onOpenPage, "translation")}
      enabled={settings.translationEnabled}
      translation={translation}
      onTranslationChange={onTranslationChange}
      takenBy={takenBy}
      onTurnOn={() => onSettingsChange({ ...settings, translationEnabled: true })}
    />
  );
}

function ClipboardSection({ onOpenPage, takenBy, clipboard, onClipboardChange }: ShortcutsSectionProps) {
  const t = useTranslation();
  return (
    <ClipboardShortcutGroup
      title={t.settings.categories.clipboard}
      action={pageLink(t, onOpenPage, "clipboard")}
      clipboard={clipboard}
      onClipboardChange={onClipboardChange}
      takenBy={takenBy}
      onTurnOn={() => onClipboardChange({ ...clipboard, enabled: true })}
    />
  );
}

function ScreenshotSection({ settings, onSettingsChange, onOpenPage, takenBy, screenshot, onScreenshotChange }: ShortcutsSectionProps) {
  const t = useTranslation();
  return (
    <ScreenshotShortcutGroup
      title={t.settings.categories.screenshot}
      action={pageLink(t, onOpenPage, "screenshot")}
      enabled={settings.screenshotEnabled}
      screenshot={screenshot}
      onScreenshotChange={onScreenshotChange}
      takenBy={takenBy}
      onTurnOn={() => onSettingsChange({ ...settings, screenshotEnabled: true })}
    />
  );
}

function VoiceInputSection({ onOpenPage, takenBy, voice, onVoiceChange }: ShortcutsSectionProps) {
  const t = useTranslation();
  return (
    <VoiceInputShortcutGroup
      action={pageLink(t, onOpenPage, "voiceInput")}
      settings={voice}
      onSettingsChange={onVoiceChange}
      takenBy={(shortcut) => takenBy(shortcut, "voiceInput")}
    />
  );
}

function PluginsSection({ onOpenPage, takenBy, refreshPlugins }: ShortcutsSectionProps) {
  const t = useTranslation();
  return <PluginShortcutSection takenBy={takenBy} onChanged={refreshPlugins} action={pageLink(t, onOpenPage, "plugins")} />;
}

type ShortcutsTab = "shortcuts" | "shortcutsIsland";

const sections = settingsSections<ShortcutsSectionProps, ShortcutsTab>();

sections.add({ id: "shortcuts.translation", category: "shortcuts", order: 10, component: TranslationSection });
sections.add({ id: "shortcuts.clipboard", category: "shortcuts", order: 20, component: ClipboardSection });
sections.add({ id: "shortcuts.screenshot", category: "shortcuts", order: 30, component: ScreenshotSection });
sections.add({ id: "shortcuts.voice-input", category: "shortcuts", order: 40, component: VoiceInputSection });
sections.add({ id: "shortcuts.plugins", category: "shortcuts", order: 50, component: PluginsSection });
sections.add({ id: "shortcutsIsland.pages", category: "shortcutsIsland", order: 10, component: PageKeysSection });
sections.add({ id: "shortcutsIsland.reference", category: "shortcutsIsland", order: 20, component: ReferenceSheetSection });

export function ShortcutsSettingsPage({
  tab,
  settings,
  onSettingsChange,
  onOpenPage,
}: {
  tab: ShortcutsTab;
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const [clipboardSettings, updateClipboardSettings] = useClipboardSettings();
  const [translationSettings, setTranslationSettings] = useTranslationSettings();
  const [screenshotSettings, setScreenshotSettings] = useScreenshotSettings();
  const [voiceSettings, setVoiceSettings] = useVoiceInputSettings();
  const { owners, finderOnly, takenBy, refreshPlugins } = useShortcutOwners(settings);

  const props = {
    settings, onSettingsChange, onOpenPage, takenBy, refreshPlugins,
    clipboard: clipboardSettings, onClipboardChange: updateClipboardSettings,
    translation: translationSettings, onTranslationChange: setTranslationSettings,
    screenshot: screenshotSettings, onScreenshotChange: setScreenshotSettings,
    voice: voiceSettings, onVoiceChange: setVoiceSettings,
  };

  return (
    <>
      <ShortcutFinder owners={[...owners, ...finderOnly]} onOpenPage={onOpenPage} />
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}

export function AllShortcutsLink({ onOpen }: { onOpen: () => void }) {
  const t = useTranslation();
  return <SettingsLinkButton onClick={onOpen}>{t.settings.shortcuts.allShortcuts}</SettingsLinkButton>;
}
