import { defineSlot } from "../../plugin-kernel/slots";
import { useDevIslandActions } from "../useDevIslandActions";

type RunnerProps = {
  openEnabledPage: (page: string) => void;
  collapseIsland: () => void;
  tuckIsland: () => void;
  revealIsland: () => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function DevIslandActions({ openEnabledPage, collapseIsland, tuckIsland, revealIsland }: RunnerProps) {
  useDevIslandActions({ openPage: openEnabledPage, collapse: collapseIsland, tuck: tuckIsland, reveal: revealIsland });
  return null;
}

runnerSlot.add({ id: "local-api.dev-island-actions", component: DevIslandActions });
