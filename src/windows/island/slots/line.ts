import type { ReactNode } from "react";
import type { AgentSession } from "../../../features/agent-status/session";
import { defineSlot } from "../../../features/plugin-kernel/slots";

export type CollapsedLineSources = {
  agentSession: AgentSession | null;
  screenshotPeek: string | null;
};

export type CollapsedLineContext = CollapsedLineSources & {
  showTitle: boolean;
  center: ReactNode | null;
  agentIcon: ReactNode | null;
};

export const lineSlot = defineSlot<CollapsedLineContext>("island.line/v1");
