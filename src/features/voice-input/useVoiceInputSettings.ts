import { useCallback, useEffect, useState } from "react";
import type { VoiceInputSettings } from "./settings";
import { VOICE_INPUT_SETTINGS_KEY, loadVoiceInputSettings, saveVoiceInputSettings } from "./storage";

const CHANGED_HERE = "fuyu-voice-input-changed";

export function useVoiceInputSettings() {
  const [settings, setSettings] = useState<VoiceInputSettings>(loadVoiceInputSettings);

  useEffect(() => {
    const reload = () => setSettings(loadVoiceInputSettings());
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === VOICE_INPUT_SETTINGS_KEY) reload();
    };
    window.addEventListener("storage", syncFromOtherWindow);
    window.addEventListener(CHANGED_HERE, reload);
    return () => {
      window.removeEventListener("storage", syncFromOtherWindow);
      window.removeEventListener(CHANGED_HERE, reload);
    };
  }, []);

  const update = useCallback((next: VoiceInputSettings) => {
    saveVoiceInputSettings(next);
    window.dispatchEvent(new Event(CHANGED_HERE));
  }, []);

  return [settings, update] as const;
}
