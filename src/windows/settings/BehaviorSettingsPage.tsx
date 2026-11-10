import { ExpandSettingsSection } from "../../features/appearance/ExpandSettingsSection";
import { GameModeSettingsSection } from "../../features/appearance/GameModeSettingsSection";
import { PageShortcutSection } from "../../features/appearance/PageShortcutSection";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { DeviceUseSettingsSection } from "../../features/device-use/DeviceUseSettingsSection";
import { LevelPopupSettingsSection } from "../../features/system-levels/LevelPopupSettingsSection";
import { DeviceAlertSettingsSection } from "../../features/device-events/DeviceAlertSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";

/**
 * Settings → Behavior: how the island reacts: opening and tucking, moving between its pages,
 * games, and the passing popups. The page keys are recorded here as well as on the Shortcuts page.
 */
export function BehaviorSettingsPage({
  settings,
  onSettingsChange,
  onOpenShortcuts,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenShortcuts: () => void;
}) {
  const [clipboardSettings] = useClipboardSettings();
  const [translationSettings] = useTranslationSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  return (
    <>
      <ExpandSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <PageShortcutSection settings={settings} onSettingsChange={onSettingsChange} takenBy={takenBy} action={<AllShortcutsLink onOpen={onOpenShortcuts} />} />
      <GameModeSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <LevelPopupSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <DeviceAlertSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <DeviceUseSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
    </>
  );
}
