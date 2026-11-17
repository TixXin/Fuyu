import { defineSlot } from "../../plugin-kernel/slots";
import { todoHandlers } from "../todoHandlers";
import { useDevIslandActions } from "../useDevIslandActions";
import { useLocalApiBridge } from "../useLocalApiBridge";

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

const handlers = todoHandlers();

function LocalApiBridge() {
  useLocalApiBridge(handlers);
  return null;
}

runnerSlot.add({ id: "local-api.dev-island-actions", component: DevIslandActions });
runnerSlot.add({ id: "local-api.bridge", component: LocalApiBridge });
