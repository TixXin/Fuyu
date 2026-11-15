import { useEffect, useState } from "react";
import type { VoiceInputSettings } from "./settings";
import { VOICE_INPUT_SETTINGS_KEY, loadVoiceInputSettings, saveVoiceInputSettings } from "./storage";

export function useVoiceInputSettings() {
  const [settings, setSettings] = useState<VoiceInputSettings>(loadVoiceInputSettings);

  useEffect(() => { saveVoiceInputSettings(settings); }, [settings]);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === VOICE_INPUT_SETTINGS_KEY) setSettings(loadVoiceInputSettings());
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  return [settings, setSettings] as const;
}
