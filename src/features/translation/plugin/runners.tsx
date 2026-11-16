import { useTranslation } from "../../../i18n";
import { LINE_PRIORITY, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandAction, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useIslandTranslation } from "../useIslandTranslation";
import { useQuickTranslation } from "../useQuickTranslation";
import { useTranslationEnabled } from "../useTranslationEnabled";
import { useTranslationIslandShortcut } from "../useTranslationIslandShortcut";
import { translationPeekState } from "./islandState";
import { OWNER } from "./owner.ts";

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

function TranslationPeek({ settings, features, openIslandPage }: RunnerProps) {
  const t = useTranslation();
  const peek = useQuickTranslation(settings.translationEnabled);
  const { openTranslator, openTranslationPeek } = useIslandTranslation(features.translation, openIslandPage);
  useIslandAction("translation.open", openTranslator);
  useIslandAction("translation.open-peek", openTranslationPeek);
  translationPeekState.useProvide(peek);
  const list: IslandContribution[] = peek === null ? [] : [
    { kind: "line", item: "translation.peek", priority: LINE_PRIORITY.peek, always: true, bare: true, drop: true, action: "translation.open-peek", label: t.translator.peekLabel(peek) },
    { kind: "reveal", reveal: "allowed", pauseIdle: true },
    { kind: "busy" },
  ];
  useIslandContributions(OWNER, "translation.peek", list);
  return null;
}

runnerSlot.add({ id: "translation.wiring", component: TranslationWiring }, OWNER);
runnerSlot.add({ id: "translation.peek", component: TranslationPeek }, OWNER);
