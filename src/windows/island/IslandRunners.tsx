import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot } from "../../features/plugin-kernel/slots";
import type { Dispatch, SetStateAction } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import type { openSettingsWindow } from "../settings/api";
import type { takeIslandClickFocus } from "./api";
import type { IslandFeatures } from "./features";
import type { IslandMode, IslandPage } from "./types";
import { useTrayMenuOpenPage } from "./useTrayMenuOpenPage";
import "./slots/builtins";

export type IslandRunnerProps = {
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  barText: boolean;
  demo: { active: boolean; startedAt: number };
  background: string;
  accent: string | null;
  page: IslandPage;
  settings: IslandSettings;
  setSettings: Dispatch<SetStateAction<IslandSettings>>;
  openSettings: typeof openSettingsWindow;
  takeClickFocus: typeof takeIslandClickFocus;
  features: IslandFeatures;
  openIslandPage: (page: IslandPage) => void;
  openEnabledPage: (page: IslandPage) => void;
  collapseIsland: () => void;
  tuckIsland: () => void;
  revealIsland: () => void;
};

const runnerSlot = defineSlot<IslandRunnerProps>("island.runner/v1");

export function IslandRunners(props: IslandRunnerProps) {
  useTrayMenuOpenPage(props.openEnabledPage);
  return <SlotView slot={runnerSlot} props={props} />;
}
