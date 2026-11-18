import { useState, type Dispatch, type SetStateAction } from "react";
import { SettingsFolderRow } from "../../components/settings/SettingsFolderRow";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../lib/settings/types";
import { ScreenshotShortcutRows } from "./ScreenshotShortcutRows";
import { CARD_SECONDS, HISTORY_DAYS, type CardSeconds, type HistoryDays, type ScreenshotSettings } from "./settings";
import { RecordSettingsGroup } from "./RecordSettingsGroup";
import { useScreenshotSettings } from "./useScreenshotSettings";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { FeatureHeader } from "../../components/settings/FeatureHeader";
import { AllShortcutsLink } from "../../components/settings/AllShortcutsLink";
import { useShortcutOwners } from "../../lib/shortcut/useShortcutOwners";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";
import { settingsCategoryIcon } from "../plugin-kernel/settingsCategories";

type ScreenshotSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenShortcuts: () => void;
  screenshot: ScreenshotSettings;
  onScreenshotChange: Dispatch<SetStateAction<ScreenshotSettings>>;
  takenBy: ReturnType<typeof useShortcutOwners>["takenBy"];
  folderDraft: string;
  onFolderDraftChange: (folder: string) => void;
  onSaveFolder: () => void;
};

function ShortcutsSection({ onOpenShortcuts, screenshot, onScreenshotChange: setScreenshot, takenBy }: ScreenshotSectionProps) {
  const text = useTranslation().settings.screenshot;
  return (
    <SettingsGroup
      title={text.shortcutsTitle}
      footer={<SettingsFootnote text={isMacOS ? text.shortcutsHintMac : text.shortcutsHint} />}
      action={<AllShortcutsLink onOpen={onOpenShortcuts} />}
    >
      <ScreenshotShortcutRows
        settings={screenshot}
        onSettingsChange={setScreenshot}
        takenBy={(shortcut, action) => takenBy(shortcut, `screenshot:${action}`)}
      />
      {!isMacOS && (
        <SettingsToggleRow
          title={text.printScreen}
          description={text.printScreenHint}
          checked={screenshot.printScreen}
          onChange={(printScreen) => setScreenshot({ ...screenshot, printScreen })}
        />
      )}
    </SettingsGroup>
  );
}

function CapturingSection({ settings, onSettingsChange }: ScreenshotSectionProps) {
  const text = useTranslation().settings.screenshot;
  return (
    <SettingsGroup title={text.whileCapturingTitle}>
      <SettingsToggleRow
        title={text.guides}
        description={text.guidesHint}
        checked={settings.screenshotGuides}
        onChange={(screenshotGuides) => onSettingsChange({ ...settings, screenshotGuides })}
      />
    </SettingsGroup>
  );
}

function AfterSection({ screenshot, onScreenshotChange: setScreenshot, folderDraft, onFolderDraftChange, onSaveFolder }: ScreenshotSectionProps) {
  const settingsText = useTranslation().settings;
  const text = settingsText.screenshot;
  const dataHome = settingsText.dataHome;
  return (
    <SettingsGroup title={text.afterTitle}>
      <SettingsFolderRow
        title={text.saveFolder}
        description={isMacOS ? text.saveFolderHintMac : text.saveFolderHint}
        value={folderDraft}
        placeholder={text.saveFolderPlaceholder}
        ariaLabel={text.saveFolder}
        revealPath={folderDraft.trim() || null}
        revealLabel={isMacOS ? dataHome.revealMac : dataHome.reveal}
        browseTitle={text.saveFolder}
        browseLabel={dataHome.change}
        resetLabel={folderDraft.trim() ? dataHome.useDefault : undefined}
        onChange={onFolderDraftChange}
        onSubmit={onSaveFolder}
        onPick={(picked) => {
          onFolderDraftChange(picked);
          setScreenshot({ ...screenshot, saveFolder: picked });
        }}
        onReset={folderDraft.trim() ? () => { onFolderDraftChange(""); setScreenshot({ ...screenshot, saveFolder: "" }); } : undefined}
      />
      <SettingsRow
        title={text.cardSeconds}
        description={text.cardSecondsHint}
        control={
          <SettingsSelect
            value={String(screenshot.cardSeconds)}
            options={CARD_SECONDS.map((seconds) => ({ value: String(seconds), label: text.cardSecondsOption(seconds) }))}
            ariaLabel={text.cardSeconds}
            onChange={(seconds) => setScreenshot({ ...screenshot, cardSeconds: Number(seconds) as CardSeconds })}
          />
        }
      />
      <SettingsRow
        title={text.historyDays}
        description={text.historyDaysHint}
        control={
          <SettingsSelect
            value={String(screenshot.historyDays)}
            options={HISTORY_DAYS.map((days) => ({ value: String(days), label: text.historyDaysOption(days) }))}
            ariaLabel={text.historyDays}
            onChange={(days) => setScreenshot({ ...screenshot, historyDays: Number(days) as HistoryDays })}
          />
        }
      />
    </SettingsGroup>
  );
}

function RecordSection({ screenshot, onScreenshotChange }: ScreenshotSectionProps) {
  return <RecordSettingsGroup screenshot={screenshot} onChange={onScreenshotChange} />;
}

type ScreenshotTab = "screenshot" | "screenshotRecord";

const sections = settingsSections<ScreenshotSectionProps, ScreenshotTab>();

sections.add({ id: "screenshot.capturing", category: "screenshot", order: 10, component: CapturingSection });
sections.add({ id: "screenshot.after", category: "screenshot", order: 20, component: AfterSection });
sections.add({ id: "screenshot.shortcuts", category: "screenshot", order: 30, component: ShortcutsSection });
sections.add({ id: "screenshotRecord.record", category: "screenshotRecord", order: 10, component: RecordSection });

export function ScreenshotSettingsPage({
  tab,
  settings,
  onSettingsChange,
  onOpenShortcuts,
}: {
  tab: ScreenshotTab;
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenShortcuts: () => void;
}) {
  const [screenshot, setScreenshot] = useScreenshotSettings();
  const { takenBy } = useShortcutOwners(settings);
  const [folderDraft, setFolderDraft] = useState(screenshot.saveFolder);
  const saveFolder = () => {
    const folder = folderDraft.trim();
    setFolderDraft(folder);
    if (folder !== screenshot.saveFolder) setScreenshot({ ...screenshot, saveFolder: folder });
  };
  const props = { settings, onSettingsChange, onOpenShortcuts, screenshot, onScreenshotChange: setScreenshot, takenBy, folderDraft, onFolderDraftChange: setFolderDraft, onSaveFolder: saveFolder };
  const shown: ScreenshotTab = tab === "screenshotRecord" && !isMacOS ? "screenshotRecord" : "screenshot";

  return (
    <>
      <FeatureHeader feature="screenshot" icon={settingsCategoryIcon("screenshot")} />
      <SlotView slot={sections} group={shown} props={props} />
    </>
  );
}
