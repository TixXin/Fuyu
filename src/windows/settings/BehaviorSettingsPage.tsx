import { ExpandSettingsSection } from "../../features/appearance/ExpandSettingsSection";
import { GameModeSettingsSection } from "../../features/appearance/GameModeSettingsSection";
import { DeviceUseSettingsSection } from "../../features/device-use/DeviceUseSettingsSection";
import { LevelPopupSettingsSection } from "../../features/system-levels/LevelPopupSettingsSection";
import { DeviceAlertSettingsSection } from "../../features/device-events/DeviceAlertSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";

/** Settings → Behavior: how the island reacts: opening and tucking, games, and the passing popups. */
export function BehaviorSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  return (
    <>
      <ExpandSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <GameModeSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <LevelPopupSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <DeviceAlertSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <DeviceUseSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
    </>
  );
}
