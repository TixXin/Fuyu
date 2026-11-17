import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../plugin-kernel/useBuiltinPlugins";
import { configureVoiceInput } from "./api";
import { OWNER } from "./plugin/owner.ts";
import { withVoicePluginSwitch, type VoiceInputSettings } from "./settings";
import { VOICE_INPUT_SETTINGS_KEY, loadVoiceInputSettings, saveVoiceInputSettings } from "./storage";

export const VOICE_INPUT_CHANGED_EVENT = "fuyu-voice-input-changed";

export function useVoiceInputSettings() {
  const [stored, setStored] = useState<VoiceInputSettings>(loadVoiceInputSettings);
  const plugins = useBuiltinPlugins();
  const pluginOn = plugins?.find((plugin) => plugin.id === OWNER)?.enabled;
  const settings = useMemo(() => withVoicePluginSwitch(stored, pluginOn), [stored, pluginOn]);
  const latest = useRef({ settings, pluginOn });
  latest.current = { settings, pluginOn };

  useEffect(() => {
    const reload = () => setStored(loadVoiceInputSettings());
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === VOICE_INPUT_SETTINGS_KEY) reload();
    };
    window.addEventListener("storage", syncFromOtherWindow);
    window.addEventListener(VOICE_INPUT_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener("storage", syncFromOtherWindow);
      window.removeEventListener(VOICE_INPUT_CHANGED_EVENT, reload);
    };
  }, []);

  const update = useCallback((next: VoiceInputSettings) => {
    const before = latest.current.settings;
    saveVoiceInputSettings(next);
    window.dispatchEvent(new Event(VOICE_INPUT_CHANGED_EVENT));
    if (next.shortcut !== before.shortcut) {
      void configureVoiceInput(next.enabled, next.shortcut).catch((error: unknown) => {
        console.error("Failed to update the voice input shortcut", error);
      });
    }
    if (next.enabled !== before.enabled && latest.current.pluginOn !== undefined) {
      void switchBuiltinPlugin(OWNER, next.enabled).catch((error: unknown) => {
        console.error("Failed to switch the voice-input plugin", error);
      });
    }
  }, []);

  return [settings, update] as const;
}
