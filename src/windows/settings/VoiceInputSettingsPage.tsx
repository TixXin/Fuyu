import type { IslandSettings } from "../../features/appearance/types";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { useScreenshotSettings } from "../../features/screenshot/useScreenshotSettings";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { VoiceInputSettingsSection } from "../../features/voice-input/VoiceInputSettingsSection";
import { useVoiceInputSettings } from "../../features/voice-input/useVoiceInputSettings";
import { FeatureHeader } from "./FeatureHeader";
import { useShortcutOwners } from "./useShortcutOwners";

export function VoiceInputSettingsPage({ settings }: { settings: IslandSettings }) {
  const [voice, setVoice] = useVoiceInputSettings();
  const [clipboard] = useClipboardSettings();
  const [translation] = useTranslationSettings();
  const [screenshot] = useScreenshotSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard, translation, screenshot, voice });
  return (
    <>
      <FeatureHeader feature="voiceInput" />
      <VoiceInputSettingsSection settings={voice} onSettingsChange={setVoice} takenBy={(shortcut) => takenBy(shortcut, "voiceInput")} />
    </>
  );
}
