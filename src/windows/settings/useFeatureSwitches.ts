import { useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { isBuiltinEnabled, switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useVoiceInputSettings } from "../../features/voice-input/useVoiceInputSettings";
import { pagesOfFeaturesOff, type SettingsCategory, type SettingsFeature } from "./categories";

export type FeatureSwitch = { on: boolean; set: (on: boolean) => void };

export type FeatureSwitches = Record<SettingsFeature, FeatureSwitch>;

const PLUGINS: Record<Exclude<SettingsFeature, "voiceInput">, { id: string; fallback?: keyof IslandSettings }> = {
  todos: { id: "todos", fallback: "todoEnabled" },
  calendar: { id: "calendar", fallback: "calendarEnabled" },
  music: { id: "music", fallback: "musicEnabled" },
  translation: { id: "translation", fallback: "translationEnabled" },
  clipboard: { id: "clipboard" },
  shelf: { id: "file-shelf", fallback: "shelfEnabled" },
  screenshot: { id: "screenshot", fallback: "screenshotEnabled" },
  agents: { id: "agents", fallback: "agentStatusEnabled" },
};

export function useFeatureSwitches(
  settings: IslandSettings,
  _onSettingsChange?: (update: (current: IslandSettings) => IslandSettings) => void,
): { switches: FeatureSwitches; hiddenPages: ReadonlySet<SettingsCategory> } {
  const plugins = useBuiltinPlugins();
  const [voice, updateVoice] = useVoiceInputSettings();
  return useMemo(() => {
    const plugin = (feature: Exclude<SettingsFeature, "voiceInput">): FeatureSwitch => {
      const { id, fallback } = PLUGINS[feature];
      const defaultOn = fallback ? Boolean(settings[fallback]) : true;
      return {
        on: isBuiltinEnabled(plugins, id, defaultOn),
        set: (enabled) => void switchBuiltinPlugin(id, enabled).catch((error: unknown) => console.error(`Could not switch the ${id} plugin`, error)),
      };
    };
    const switches: FeatureSwitches = {
      todos: plugin("todos"),
      calendar: plugin("calendar"),
      music: plugin("music"),
      translation: plugin("translation"),
      clipboard: plugin("clipboard"),
      shelf: plugin("shelf"),
      screenshot: plugin("screenshot"),
      voiceInput: {
        on: isBuiltinEnabled(plugins, "voice-input", voice.enabled),
        set: (enabled) => updateVoice({ ...voice, enabled }),
      },
      agents: plugin("agents"),
    };
    const on = Object.fromEntries(Object.entries(switches).map(([feature, value]) => [feature, value.on])) as Record<SettingsFeature, boolean>;
    return { switches, hiddenPages: pagesOfFeaturesOff(on) };
  }, [plugins, settings, voice, updateVoice]);
}
