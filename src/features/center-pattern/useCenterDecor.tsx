import { useMemo, type ComponentProps } from "react";
import { isCollapsedItemOffBar } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { usePageHidden } from "../../lib/usePageHidden";
import type { IslandDecor } from "../plugin-kernel/islandDecor";
import { defineSlot, type IslandCollapsedCenterMeta, type SlotWidth } from "../plugin-kernel/slots";
import { SlotView } from "../plugin-kernel/SlotView";
import { useSlotEntries } from "../plugin-kernel/useSlotEntries";
import { CenterPattern } from "./CenterPattern";
import { AGENT_ICON_PET_HEIGHT, CollapsedCenter, MARK_HEIGHT, MARK_WIDTH, agentIconMarkExtraWidth, centerHeight } from "./CollapsedCenter";
import { centerPatternChoice, centerPatternSize, type AgentActivity } from "./centerSettings";
import { PetSprite } from "./PetSprite";
import { usePetMood } from "./usePetMood";
import { usePetSheet } from "./usePetSheet";

type CenterContext = ComponentProps<typeof CollapsedCenter> & { enabled: boolean };

const centerSlot = defineSlot<CenterContext, IslandCollapsedCenterMeta<CenterContext>>("island.collapsed-center/v1");

const MARK_LIGHT_EXTRA_WIDTH = MARK_WIDTH - 9;
const NO_SETTINGS: Readonly<Record<string, unknown>> = {};

type CenterDecorOptions = {
  paused: boolean;
  agents: readonly AgentActivity[];
  markLight: boolean;
  enabled?: boolean;
  settings?: Readonly<Record<string, unknown>>;
};

function slotWidth<Context>(width: SlotWidth<Context> | undefined, context: Context) {
  return typeof width === "function" ? width(context) : width ?? 0;
}

export function useCenterDecor({ paused, agents, markLight, enabled = false, settings = NO_SETTINGS }: CenterDecorOptions): IslandDecor {
  const { placements } = useCollapsedPlacements();
  const lightShown = markLight && !isCollapsedItemOffBar(placements, "status-light");
  const mood = usePetMood(agents, enabled || lightShown);
  const choice = useMemo(() => centerPatternChoice(settings), [settings]);
  const size = centerPatternSize(settings);
  const sheet = usePetSheet(enabled ? choice.petId : null, settings);
  const hidden = usePageHidden();
  const still = paused || hidden;
  const [centerEntry] = useSlotEntries(centerSlot);
  const centerContext = useMemo<CenterContext>(
    () => ({ enabled, choice, sheet, mood, paused: still, size }),
    [enabled, choice, sheet, mood, still, size],
  );
  return useMemo(() => {
    const decor: IslandDecor = {};
    if (centerEntry && (centerEntry.shown?.(centerContext) ?? true)) {
      decor.center = <SlotView slot={centerSlot} props={centerContext} />;
      decor.centerWidth = slotWidth(centerEntry.width, centerContext);
    }
    if (enabled) {
      const pet = typeof sheet === "string" ? sheet : null;
      if (pet) decor.agentIcon = <PetSprite src={pet} mood={mood} paused={still} height={AGENT_ICON_PET_HEIGHT} />;
      else if (choice.pattern === "mark" && !lightShown) {
        decor.agentIcon = <CenterPattern pattern="mark" mood={mood} paused={still} height={centerHeight("mark", size)} />;
        decor.agentIconWidth = agentIconMarkExtraWidth(size);
      }
    }
    if (lightShown) {
      decor.sideWidth = MARK_LIGHT_EXTRA_WIDTH;
      decor.statusLight = <CenterPattern pattern="mark" mood={mood} paused={still} height={MARK_HEIGHT} />;
    }
    return decor;
  }, [centerEntry, centerContext, enabled, choice, size, sheet, mood, still, lightShown]);
}
