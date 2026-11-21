import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { isPanelOpen, panelOpenIsFresh, panelOpens, subscribePanelAwake } from "../../../../components/island-widget/panelAwake";
import type { WidgetEntrance } from "../../../../lib/settings/types";
import { drawEntrance, EMPTY_ENTRANCE_BAG, type WidgetEntranceEffect } from "../../../../lib/theme/widgetEntrance";

export type EntranceRun = { id: number; effect: WidgetEntranceEffect | null; data: boolean; done: () => void };

let bag = EMPTY_ENTRANCE_BAG;

function pick(setting: WidgetEntrance): WidgetEntranceEffect | null {
  if (setting === "fade") return null;
  if (setting !== "shuffle") return setting;
  const drawn = drawEntrance(bag, Math.random);
  bag = drawn.bag;
  return drawn.effect;
}

export function useEntranceRun(setting: WidgetEntrance, data: boolean, enabled: boolean): EntranceRun | null {
  const opens = useSyncExternalStore(subscribePanelAwake, panelOpens);
  const open = useSyncExternalStore(subscribePanelAwake, isPanelOpen);
  const [handled, setHandled] = useState(() => (panelOpenIsFresh() ? panelOpens() - 1 : panelOpens()));
  const pending = open && enabled && (setting !== "fade" || data) && opens !== handled;
  if (!pending && handled !== opens) setHandled(opens);
  const effect = useMemo(() => (pending ? pick(setting) : null), [pending, setting]);
  const done = useCallback(() => setHandled(panelOpens()), []);
  return useMemo(() => (pending ? { id: opens, effect, data, done } : null), [pending, opens, effect, data, done]);
}
