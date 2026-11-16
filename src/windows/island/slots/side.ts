import type { AgentVisualState } from "../../../features/agent-status/status";
import type { MessageSource } from "../../../features/messages/messagePreview";
import { defineSlot } from "../../../features/plugin-kernel/slots";
import type { IslandPage } from "../types";

export type SideRowSources = {
  agentVisualState: AgentVisualState;
  agentSessionCount: number | null;
  unreadCount: number;
  shelfCount: number | null;
};

export type SideRowContext = SideRowSources & {
  onOpenPage: (page: IslandPage) => void;
  onOpenMessages: (source: MessageSource) => void;
};

export const SIDE_GAUGES_ORDER = 60;

export const sideSlot = defineSlot<SideRowContext>("island.side/v1");
