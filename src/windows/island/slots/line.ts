import type { ReactNode } from "react";
import { defineSlot } from "../../../features/plugin-kernel/slots";

export type CollapsedLineContext = {
  showTitle: boolean;
  center: ReactNode | null;
  agentIcon: ReactNode | null;
};

export type IslandSummaryContext = {
  enabled: boolean;
  bodyOnly: boolean;
  children: ReactNode;
};

export const lineSlot = defineSlot<CollapsedLineContext>("island.line/v1");
export const summarySlot = defineSlot<IslandSummaryContext>("island.line/v1");
