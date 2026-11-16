import type { ComponentProps, ReactNode } from "react";
import type { CollapsedCenter } from "../../../features/center-pattern";
import { defineSlot, type IslandCollapsedCenterMeta, type IslandCollapsedMeta, type SlotWidth } from "../../../features/plugin-kernel/slots";
import type { Translations } from "../../../i18n";
import type { openSettingsWindow } from "../../settings/api";
import type { listenIslandHover } from "../api";
import type { CollapsedSlots, IslandPage } from "../types";

export type CollapsedBarContext = {
  t: Translations;
  statusLight: ReactNode;
  hints: ReadonlySet<string>;
  slots: CollapsedSlots;
  onOpenPage: (page: IslandPage) => void;
  onOpenSettings: typeof openSettingsWindow;
};

export type CollapsedGaugeContext = {
  paused: boolean;
  usage: { enabled: boolean; settings: Record<string, unknown>; showRemaining: boolean };
  timer: { enabled: boolean; running: boolean };
  listenIslandHover: typeof listenIslandHover;
};

export type CollapsedCenterContext = ComponentProps<typeof CollapsedCenter> & { enabled: boolean };

export const collapsedBarSlot = defineSlot<CollapsedBarContext, IslandCollapsedMeta<CollapsedBarContext>>("island.collapsed/v1");
export const collapsedGaugeSlot = defineSlot<CollapsedGaugeContext, IslandCollapsedMeta<CollapsedGaugeContext>>("island.collapsed/v1");
export const collapsedCenterSlot = defineSlot<CollapsedCenterContext, IslandCollapsedCenterMeta<CollapsedCenterContext>>("island.collapsed-center/v1");

export const PLUGIN_STATUS_ORDER = 35;

export function slotWidth<Context>(width: SlotWidth<Context> | undefined, context: Context) {
  return typeof width === "function" ? width(context) : width ?? 0;
}

function StatusLightItem({ statusLight }: CollapsedBarContext) {
  return statusLight;
}

collapsedBarSlot.add({ id: "status-light", order: 10, component: StatusLightItem });
