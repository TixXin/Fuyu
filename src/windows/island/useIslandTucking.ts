import { useCallback } from "react";
import type { IslandSettings } from "../../features/appearance/types";
import { useIdleTuck, useRevealOnMessage, useRevealOnRequest } from "./useIslandAutomation";
import type { useIslandNavigation } from "./useIslandNavigation";
import { useTuckPeek } from "./useTuckPeek";

type IslandTuckingOptions = {
  settings: IslandSettings;
  navigation: ReturnType<typeof useIslandNavigation>;
  hasMessagePreview: boolean;
  hasPermissionPrompt: boolean;
  hasTranslationPeek: boolean;
  holdTuck: boolean;
};

export function useIslandTucking({ settings, navigation, hasMessagePreview, hasPermissionPrompt, hasTranslationPeek, holdTuck }: IslandTuckingOptions) {
  const { mode, page, isTucked, isPeeking, peekRetractDelayMs, idleTuck, revealIsland, endPeek } = navigation;
  const tuckWhenIdle = useCallback(
    () => idleTuck(settings.autoTuckRetract ? settings.autoTuckRetractDelayMs : null),
    [idleTuck, settings.autoTuckRetract, settings.autoTuckRetractDelayMs],
  );
  useIdleTuck(settings.autoTuck && !hasMessagePreview && !hasTranslationPeek && !holdTuck, settings.autoTuckSeconds, isTucked, `${mode}:${page}`, tuckWhenIdle);
  useRevealOnMessage(hasMessagePreview, isTucked, revealIsland);
  useRevealOnRequest(revealIsland);
  useRevealOnMessage(hasPermissionPrompt, isTucked, revealIsland);
  useRevealOnMessage(hasTranslationPeek, isTucked && settings.revealOnMessage, revealIsland);
  useTuckPeek(isPeeking, endPeek, peekRetractDelayMs ?? undefined);
}
