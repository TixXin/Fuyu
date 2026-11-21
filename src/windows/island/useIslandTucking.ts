import { useCallback, useEffect } from "react";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import type { IslandSettings } from "../../lib/settings/types";
import { useIdleTuck, useRevealOnMessage, useRevealOnRequest } from "./useIslandAutomation";
import type { useIslandNavigation } from "./useIslandNavigation";
import { shouldRecallIdleTuck } from "./tuckRecall";
import { useIslandOnTaskbar } from "./useIslandOnTaskbar";
import { useTuckPeek } from "./useTuckPeek";

type IslandTuckingOptions = {
  settings: IslandSettings;
  navigation: ReturnType<typeof useIslandNavigation>;
};

export function useIslandTucking({ settings, navigation }: IslandTuckingOptions) {
  const { mode, page, isTucked, tuckSource, isPeeking, peekRetractDelayMs, idleTuck, revealIsland, endPeek } = navigation;
  const { reveal, hold } = useIslandContributed();
  const onTaskbar = useIslandOnTaskbar().placed;
  const tuckWhenIdle = useCallback(
    () => idleTuck(settings.autoTuckRetract ? settings.autoTuckRetractDelayMs : null),
    [idleTuck, settings.autoTuckRetract, settings.autoTuckRetractDelayMs],
  );
  useIdleTuck(settings.autoTuck && !onTaskbar && !reveal.pauseIdle && !hold, settings.autoTuckSeconds, isTucked, `${mode}:${page}`, tuckWhenIdle);
  useRevealOnMessage(reveal.always, isTucked, revealIsland);
  useRevealOnRequest(revealIsland);
  useRevealOnMessage(reveal.allowed, isTucked && settings.revealOnMessage, revealIsland);
  const recall = shouldRecallIdleTuck({ isTucked, tuckSource, hold: hold || onTaskbar, autoTuck: settings.autoTuck });
  useEffect(() => {
    if (recall) revealIsland();
  }, [recall, revealIsland]);
  useTuckPeek(isPeeking, endPeek, peekRetractDelayMs ?? undefined);
}
