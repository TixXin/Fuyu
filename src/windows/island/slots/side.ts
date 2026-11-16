import { defineSlot } from "../../../features/plugin-kernel/slots";
import type { IslandPage } from "../types";

export type SideRowContext = {
  onOpenPage: (page: IslandPage) => void;
};

export const SIDE_GAUGES_ORDER = 60;

export const sideSlot = defineSlot<SideRowContext>("island.side/v1");
