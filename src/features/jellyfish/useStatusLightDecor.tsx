import { useMemo } from "react";
import { isCollapsedItemOffBar } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { usePageHidden } from "../../lib/usePageHidden";
import type { IslandDecor } from "../plugin-kernel/islandDecor";
import type { AgentActivity } from "../center-pattern/centerSettings";
import { MARK_HEIGHT, MARK_WIDTH } from "../center-pattern/CollapsedCenter";
import { usePetMood } from "../center-pattern/usePetMood";
import { JellyfishMark } from "./JellyfishMark";

const MARK_LIGHT_EXTRA_WIDTH = MARK_WIDTH - 9;
const NONE: IslandDecor = {};

export function useMarkLightShown(markLight: boolean) {
  const { placements } = useCollapsedPlacements();
  return markLight && !isCollapsedItemOffBar(placements, "status-light");
}

export function useStatusLightDecor({ paused, agents, markLight }: { paused: boolean; agents: readonly AgentActivity[]; markLight: boolean }): IslandDecor {
  const shown = useMarkLightShown(markLight);
  const mood = usePetMood(agents, shown);
  const hidden = usePageHidden();
  const still = paused || hidden;
  return useMemo(
    () => (shown ? { sideWidth: MARK_LIGHT_EXTRA_WIDTH, statusLight: <JellyfishMark mood={mood} paused={still} height={MARK_HEIGHT} /> } : NONE),
    [shown, mood, still],
  );
}
