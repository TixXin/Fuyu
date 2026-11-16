import type { IslandSettings } from "../../lib/settings/types";
import { VoiceInputSettingsSection } from "./VoiceInputSettingsSection";
import { useVoiceInputSettings } from "./useVoiceInputSettings";
import { FeatureHeader } from "../../components/settings/FeatureHeader";
import { useShortcutOwners } from "../../lib/shortcut/useShortcutOwners";
import { settingsCategoryIcon } from "../plugin-kernel/settingsCategories";

export function VoiceInputSettingsPage({ settings }: { settings: IslandSettings }) {
  const [voice, setVoice] = useVoiceInputSettings();
  const { takenBy } = useShortcutOwners(settings);
  return (
    <>
      <FeatureHeader feature="voiceInput" icon={settingsCategoryIcon("voiceInput")} />
      <VoiceInputSettingsSection settings={voice} onSettingsChange={setVoice} takenBy={(shortcut) => takenBy(shortcut, "voiceInput")} />
    </>
  );
}
