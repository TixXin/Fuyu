import { useCallback } from "react";
import { presentTranslationWindow, toggleTranslationWindow } from "../../features/translation/api";
import { requestTranslationHandoffOpen } from "../../features/translation/storage";
import { useTranslationEnabled } from "../../features/translation/useTranslationEnabled";
import { useTranslationIslandShortcut } from "../../features/translation/useTranslationIslandShortcut";
import type { IslandMode, IslandPage } from "./types";

function reportOpenFailure(error: unknown) {
  console.error("Failed to open translation", error);
}

export function useIslandTranslation(
  enabled: boolean,
  inIsland: boolean,
  mode: IslandMode,
  page: IslandPage,
  openIslandPage: (page: IslandPage) => void,
  collapseIsland: () => void,
) {
  useTranslationEnabled(enabled, inIsland);

  const openTranslator = useCallback(() => {
    if (inIsland) openIslandPage("translation");
    else void toggleTranslationWindow().catch(reportOpenFailure);
  }, [inIsland, openIslandPage]);

  useTranslationIslandShortcut(enabled && inIsland, () => {
    if (mode === "expanded" && page === "translation") collapseIsland();
    else openIslandPage("translation");
  });

  const openTranslationPeek = useCallback(() => {
    requestTranslationHandoffOpen();
    if (inIsland) openIslandPage("translation");
    else void presentTranslationWindow().catch(reportOpenFailure);
  }, [inIsland, openIslandPage]);

  return { openTranslator, openTranslationPeek };
}
