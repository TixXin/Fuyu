import type { IslandSettings } from "../../lib/settings/types";
import { VoiceInputSettingsSection } from "../../features/voice-input/VoiceInputSettingsSection";
import { useVoiceInputSettings } from "../../features/voice-input/useVoiceInputSettings";
import { FeatureHeader } from "./FeatureHeader";
import { useShortcutOwners } from "./useShortcutOwners";

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
