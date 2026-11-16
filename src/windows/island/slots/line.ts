import type { ReactNode } from "react";
import { defineSlot } from "../../../features/plugin-kernel/slots";

export type CollapsedLineContext = {
  showTitle: boolean;
  center: ReactNode | null;
  agentIcon: ReactNode | null;
};

export const lineSlot = defineSlot<CollapsedLineContext>("island.line/v1");
