import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot } from "../../features/plugin-kernel/slots";
import type { IslandSettings } from "../../lib/settings/types";
import type { IslandFeatures } from "./features";
import type { IslandMode, IslandPage } from "./types";
import { useTrayMenuOpenPage } from "./useTrayMenuOpenPage";
import "./slots/builtins";

export type IslandRunnerProps = {
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  page: IslandPage;
  settings: IslandSettings;
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
