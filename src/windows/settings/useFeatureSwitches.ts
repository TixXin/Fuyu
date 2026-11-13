import { useMemo } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { pagesOfFeaturesOff, type SettingsCategory, type SettingsFeature } from "./categories";

export type FeatureSwitch = { on: boolean; set: (on: boolean) => void };

export type FeatureSwitches = Record<SettingsFeature, FeatureSwitch>;

type FlagKey = "todoEnabled" | "calendarEnabled" | "musicEnabled" | "translationEnabled" | "shelfEnabled" | "screenshotEnabled" | "agentStatusEnabled";

const FLAGS: Record<Exclude<SettingsFeature, "clipboard">, FlagKey> = {
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
  const [clipboard, updateClipboard] = useClipboardSettings();
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
      clipboard: { on: clipboard.enabled, set: (enabled) => void updateClipboard({ ...clipboard, enabled }) },
      shelf: flag(FLAGS.shelf),
      screenshot: flag(FLAGS.screenshot),
      agents: flag(FLAGS.agents),
    };
    const on = Object.fromEntries(Object.entries(switches).map(([feature, value]) => [feature, value.on])) as Record<SettingsFeature, boolean>;
    return { switches, hiddenPages: pagesOfFeaturesOff(on) };
  }, [settings, clipboard, onSettingsChange, updateClipboard]);
}
