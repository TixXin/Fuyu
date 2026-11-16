import { defineSlot } from "../../../features/plugin-kernel/slots";
import type { IslandSettings } from "../../../lib/settings/types";

export interface SettingsRunnerProps {
  settings: IslandSettings;
}

export const runnerSlot = defineSlot<SettingsRunnerProps>("settings.runner/v1");
