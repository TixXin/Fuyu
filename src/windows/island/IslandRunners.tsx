import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot } from "../../features/plugin-kernel/slots";
import type { IslandSettings } from "../../lib/settings/types";
import type { IslandFeatures } from "./features";
import type { IslandMode, IslandPage } from "./types";
import "./slots/builtins";

export type IslandRunnerProps = {
  mode: IslandMode;
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
  return <SlotView slot={runnerSlot} props={props} />;
}
