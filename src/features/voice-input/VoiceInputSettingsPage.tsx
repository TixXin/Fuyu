import type { IslandSettings } from "../../lib/settings/types";
import { VoiceInputSettingsSection } from "./VoiceInputSettingsSection";
import { useVoiceInputSettings } from "./useVoiceInputSettings";
import { FeatureHeader } from "../../windows/settings/FeatureHeader";
import { useShortcutOwners } from "../../windows/settings/useShortcutOwners";

export function VoiceInputSettingsPage({ settings }: { settings: IslandSettings }) {
  const [voice, setVoice] = useVoiceInputSettings();
  const { takenBy } = useShortcutOwners(settings);
  return (
    <>
      <FeatureHeader feature="voiceInput" />
      <VoiceInputSettingsSection settings={voice} onSettingsChange={setVoice} takenBy={(shortcut) => takenBy(shortcut, "voiceInput")} />
    </>
  );
}
