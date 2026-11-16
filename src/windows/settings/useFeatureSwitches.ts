import { useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinEnabled } from "../../features/plugin-kernel/useBuiltinPlugins";
import { useVoiceInputSettings } from "../../features/voice-input/useVoiceInputSettings";
import { pagesOfFeaturesOff, type SettingsCategory, type SettingsFeature } from "./categories";

export type FeatureSwitch = { on: boolean; set: (on: boolean) => void };

export type FeatureSwitches = Record<SettingsFeature, FeatureSwitch>;

type FlagKey = "todoEnabled" | "calendarEnabled" | "musicEnabled" | "translationEnabled" | "shelfEnabled" | "screenshotEnabled" | "agentStatusEnabled";

const FLAGS: Record<Exclude<SettingsFeature, "clipboard" | "voiceInput">, FlagKey> = {
  todos: "todoEnabled",
  calendar: "calendarEnabled",
  music: "musicEnabled",
  translation: "translationEnabled",
  shelf: "shelfEnabled",
  screenshot: "screenshotEnabled",
  agents: "agentStatusEnabled",
};

export function useFeatureSwitches(
  settings: IslandSettings,
  onSettingsChange: (update: (current: IslandSettings) => IslandSettings) => void,
): { switches: FeatureSwitches; hiddenPages: ReadonlySet<SettingsCategory> } {
  const clipboard = useBuiltinEnabled("clipboard");
  const [voice, updateVoice] = useVoiceInputSettings();
  return useMemo(() => {
    const flag = (key: FlagKey): FeatureSwitch => ({
      on: settings[key],
      set: (on) => onSettingsChange((current) => ({ ...current, [key]: on })),
    });
    const switches: FeatureSwitches = {
      todos: flag(FLAGS.todos),
      calendar: flag(FLAGS.calendar),
      music: flag(FLAGS.music),
      translation: flag(FLAGS.translation),
      clipboard: { on: clipboard, set: (enabled) => void switchBuiltinPlugin("clipboard", enabled).catch((error: unknown) => console.error("Could not switch the clipboard plugin", error)) },
      shelf: flag(FLAGS.shelf),
      screenshot: flag(FLAGS.screenshot),
      voiceInput: { on: voice.enabled, set: (enabled) => updateVoice({ ...voice, enabled }) },
      agents: flag(FLAGS.agents),
    };
    const on = Object.fromEntries(Object.entries(switches).map(([feature, value]) => [feature, value.on])) as Record<SettingsFeature, boolean>;
    return { switches, hiddenPages: pagesOfFeaturesOff(on) };
  }, [settings, clipboard, voice, onSettingsChange, updateVoice]);
}
