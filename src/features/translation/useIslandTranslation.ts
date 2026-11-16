import { useCallback } from "react";
import { presentTranslationWindow, toggleTranslationWindow } from "./api";
import { requestTranslationHandoffOpen } from "../../lib/translation-handoff/storage";

function reportOpenFailure(error: unknown) {
  console.error("Failed to open translation", error);
}

export function useIslandTranslation(inIsland: boolean, openIslandPage: (page: "translation") => void) {
  const openTranslator = useCallback(() => {
    if (inIsland) openIslandPage("translation");
    else void toggleTranslationWindow().catch(reportOpenFailure);
  }, [inIsland, openIslandPage]);

  const openTranslationPeek = useCallback(() => {
    requestTranslationHandoffOpen();
    if (inIsland) openIslandPage("translation");
    else void presentTranslationWindow().catch(reportOpenFailure);
  }, [inIsland, openIslandPage]);

  return { openTranslator, openTranslationPeek };
}
