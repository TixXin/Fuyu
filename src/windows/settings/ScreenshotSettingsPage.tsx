import { useState, type Dispatch, type SetStateAction } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../features/appearance/types";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { ScreenshotShortcutRows } from "../../features/screenshot/ScreenshotShortcutRows";
import { CARD_SECONDS, HISTORY_DAYS, type CardSeconds, type HistoryDays, type ScreenshotSettings } from "../../features/screenshot/settings";
import { RecordSettingsGroup } from "./RecordSettingsGroup";
import { useScreenshotSettings } from "../../features/screenshot/useScreenshotSettings";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { FeatureHeader } from "./FeatureHeader";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";

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
    <SettingsGroup title={text.shortcutsTitle} footer={isMacOS ? text.shortcutsHintMac : text.shortcutsHint} action={<AllShortcutsLink onOpen={onOpenShortcuts} />}>
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
  const text = useTranslation().settings.screenshot;
  return (
    <SettingsGroup title={text.afterTitle}>
      <SettingsRow
        title={text.saveFolder}
        description={isMacOS ? text.saveFolderHintMac : text.saveFolderHint}
        control={
          <SettingsInput
            value={folderDraft}
            placeholder={text.saveFolderPlaceholder}
            aria-label={text.saveFolder}
            onChange={(event) => onFolderDraftChange(event.target.value)}
            onBlur={onSaveFolder}
            onKeyDown={(event) => { if (event.key === "Enter") onSaveFolder(); }}
          />
        }
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

export function ScreenshotSettingsPage({
  tab,
  settings,
  onSettingsChange,
  onOpenShortcuts,
}: {
  tab: "screenshot" | "screenshotRecord";
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenShortcuts: () => void;
}) {
  const [screenshot, setScreenshot] = useScreenshotSettings();
  const [clipboard] = useClipboardSettings();
  const [translation] = useTranslationSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard, translation, screenshot });
  const [folderDraft, setFolderDraft] = useState(screenshot.saveFolder);
  const saveFolder = () => {
    const folder = folderDraft.trim();
    setFolderDraft(folder);
    if (folder !== screenshot.saveFolder) setScreenshot({ ...screenshot, saveFolder: folder });
  };
  const props = { settings, onSettingsChange, onOpenShortcuts, screenshot, onScreenshotChange: setScreenshot, takenBy, folderDraft, onFolderDraftChange: setFolderDraft, onSaveFolder: saveFolder };

  if (tab === "screenshotRecord" && !isMacOS) return <RecordSection {...props} />;

  return (
    <>
      <FeatureHeader feature="screenshot" />
      <ShortcutsSection {...props} />
      <CapturingSection {...props} />
      <AfterSection {...props} />
    </>
  );
}
