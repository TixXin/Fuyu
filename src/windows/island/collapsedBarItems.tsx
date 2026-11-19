import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { openSettingsWindow } from "../settings/api";
import { CollapsedFit } from "./CollapsedFit";
import { fitFloor } from "./collapsedFitStore";
import { collapsedOpensTarget, warnCollapsedOpens } from "./collapsedOpens";
import { collapsedBarSlot, type CollapsedBarContext } from "./slots/collapsed";
import { pageSlot } from "./slots/pageSlot";
import type { IslandPage } from "./types";
import "./slots/builtins";

export type CollapsedBarItem = { id: string; node: ReactNode; group?: "gauges"; page?: IslandPage | null };

const INTERACTIVE = "button, a[href], input, select, textarea, [role='button'], [contenteditable='true']";

function OpensPage({ page, onOpenPage, children }: { page: IslandPage; onOpenPage: (page: IslandPage) => void; children: ReactNode }) {
  const click = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const inner = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    if (inner === null || inner === event.currentTarget) onOpenPage(page);
  };
  const press = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenPage(page);
  };
  return (
    <span className="island__collapsed-opener" role="button" tabIndex={0} data-opens-page={page} onClick={click} onKeyDown={press}>
      {children}
    </span>
  );
}

export function useCollapsedBarItems(input: Omit<CollapsedBarContext, "onOpenSettings">): CollapsedBarItem[] {
  const entries = useSlotEntries(collapsedBarSlot);
  const pages = useSlotEntries(pageSlot);
  const context: CollapsedBarContext = { ...input, onOpenSettings: openSettingsWindow };
  const items: CollapsedBarItem[] = [];
  let gaugesPlaced = false;
  for (const entry of entries) {
    if (entry.group === "gauges") {
      if (!gaugesPlaced) for (const gauge of context.slots.gauges ?? []) items.push({ ...gauge, group: "gauges" });
      gaugesPlaced = true;
    } else if (entry.shown?.(context) ?? true) {
      const view = <SlotView slot={collapsedBarSlot} props={context} select={(all) => all.filter((item) => item.id === entry.id)} />;
      const node = entry.external ? <CollapsedFit id={entry.id} floor={fitFloor(entry.width, context)}>{view}</CollapsedFit> : view;
      const { page, warning } = collapsedOpensTarget(entry, pages);
      warnCollapsedOpens(warning);
      items.push({ id: entry.id, page, node: page === null ? node : <OpensPage page={page} onOpenPage={context.onOpenPage}>{node}</OpensPage> });
    }
  }
  return items;
}
