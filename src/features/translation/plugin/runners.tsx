import { defineSlot } from "../../plugin-kernel/slots";
import { useTranslationEnabled } from "../useTranslationEnabled";
import { useTranslationIslandShortcut } from "../useTranslationIslandShortcut";

type RunnerProps = {
  mode: string;
  page: string;
  settings: { translationEnabled: boolean };
  features: { translation: boolean };
  openIslandPage: (page: "translation") => void;
  collapseIsland: () => void;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function TranslationWiring({ mode, page, settings, features, openIslandPage, collapseIsland }: RunnerProps) {
  const enabled = settings.translationEnabled;
  const inIsland = features.translation;
  useTranslationEnabled(enabled, inIsland);
  useTranslationIslandShortcut(enabled && inIsland, () => {
    if (mode === "expanded" && page === "translation") collapseIsland();
    else openIslandPage("translation");
  });
  return null;
}

runnerSlot.add({ id: "translation.wiring", component: TranslationWiring });
