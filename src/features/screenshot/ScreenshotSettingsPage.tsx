import { useState, type Dispatch, type SetStateAction } from "react";
import { SettingsFolderRow } from "../../components/settings/SettingsFolderRow";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../lib/settings/types";
import { ScreenshotShortcutRows } from "./ScreenshotShortcutRows";
import { CARD_SECONDS, DELAY_SECONDS, HISTORY_DAYS, SHORTCUT_PANEL_CORNERS, SHORTCUT_PANEL_STATES, type CardSeconds, type DelaySeconds, type HistoryDays, type ScreenshotSettings, type ShortcutPanelCorner, type ShortcutPanelState } from "./settings";
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

function CapturingSection({ settings, onSettingsChange, screenshot, onScreenshotChange: setScreenshot }: ScreenshotSectionProps) {
  const text = useTranslation().settings.screenshot;
  return (
    <SettingsGroup title={text.whileCapturingTitle}>
      <SettingsToggleRow
        title={text.guides}
        description={text.guidesHint}
        checked={settings.screenshotGuides}
        onChange={(screenshotGuides) => onSettingsChange({ ...settings, screenshotGuides })}
      />
      <SettingsRow
        title={text.shortcutPanel}
        description={text.shortcutPanelHint}
        control={
          <SettingsSelect
            value={screenshot.shortcutPanel}
            options={SHORTCUT_PANEL_STATES.map((state) => ({ value: state, label: text.shortcutPanelStates[state] }))}
            ariaLabel={text.shortcutPanel}
            onChange={(state) => setScreenshot({ ...screenshot, shortcutPanel: state as ShortcutPanelState })}
          />
        }
      />
      {screenshot.shortcutPanel !== "off" && (
        <SettingsRow
          title={text.shortcutCorner}
          description={text.shortcutCornerHint}
          control={
            <SettingsSelect
              value={screenshot.shortcutCorner}
              options={SHORTCUT_PANEL_CORNERS.map((corner) => ({ value: corner, label: text.shortcutCorners[corner] }))}
              ariaLabel={text.shortcutCorner}
              onChange={(corner) => setScreenshot({ ...screenshot, shortcutCorner: corner as ShortcutPanelCorner })}
            />
          }
        />
      )}
      <SettingsRow
        title={text.delaySeconds}
        description={text.delaySecondsHint}
        control={
          <SettingsSelect
            value={String(screenshot.delaySeconds)}
            options={DELAY_SECONDS.map((seconds) => ({ value: String(seconds), label: text.delaySecondsOption(seconds) }))}
            ariaLabel={text.delaySeconds}
            onChange={(seconds) => setScreenshot({ ...screenshot, delaySeconds: Number(seconds) as DelaySeconds })}
          />
        }
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
      <SettingsToggleRow
        title={text.historyText}
        description={text.historyTextHint}
        checked={screenshot.historyText}
        onChange={(historyText) => setScreenshot({ ...screenshot, historyText })}
      />
      <SettingsToggleRow
        title={text.agentSource}
        description={text.agentSourceHint}
        checked={screenshot.agentSource}
        onChange={(agentSource) => setScreenshot({ ...screenshot, agentSource })}
      />
      <SettingsToggleRow
        title={text.restorePins}
        description={text.restorePinsHint}
        checked={screenshot.restorePins}
        onChange={(restorePins) => setScreenshot({ ...screenshot, restorePins })}
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
  const shown: ScreenshotTab = tab === "screenshotRecord" ? "screenshotRecord" : "screenshot";

  return (
    <>
      <FeatureHeader feature="screenshot" icon={settingsCategoryIcon("screenshot")} />
      <SlotView slot={sections} group={shown} props={props} />
    </>
  );
}
