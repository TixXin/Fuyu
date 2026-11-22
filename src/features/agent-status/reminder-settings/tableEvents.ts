import type { AgentPushEvent } from "../push/storage.ts";
import type { AgentSoundEvent } from "../sounds/events.ts";
import type { PreviewEvent, PreviewSwitch } from "./previewEvents.ts";

export const TABLE_EVENTS = ["waiting", "done", "failed", "started", "ack", "compact", "idle", "quotaLow", "quotaReset"] as const;

export type TableEvent = (typeof TABLE_EVENTS)[number];

export type TableIsland = { kind: "switch"; key: PreviewSwitch } | { kind: "started" } | { kind: "quota" } | { kind: "follow" } | null;

export type TableRow = {
  id: TableEvent;
  preview: PreviewEvent | null;
  island: TableIsland;
  sounds: readonly AgentSoundEvent[];
  push: AgentPushEvent | null;
};

export const TABLE_ROWS: readonly TableRow[] = [
  { id: "waiting", preview: "approval", island: { kind: "switch", key: "agentAlertWaiting" }, sounds: ["approval", "question"], push: "waiting" },
  { id: "done", preview: "done", island: { kind: "switch", key: "agentAlertCompleted" }, sounds: ["complete"], push: "completed" },
  { id: "failed", preview: "failed", island: { kind: "switch", key: "agentAlertFailed" }, sounds: ["error"], push: "failed" },
  { id: "started", preview: "started", island: { kind: "started" }, sounds: ["start"], push: null },
  { id: "ack", preview: null, island: null, sounds: ["ack"], push: null },
  { id: "compact", preview: null, island: null, sounds: ["compact"], push: null },
  { id: "idle", preview: null, island: null, sounds: ["idle"], push: null },
  { id: "quotaLow", preview: null, island: { kind: "quota" }, sounds: ["quotaLow"], push: null },
  { id: "quotaReset", preview: null, island: { kind: "follow" }, sounds: ["quotaReset"], push: null },
];

const ROW_OF: Record<PreviewEvent, TableEvent> = {
  approval: "waiting",
  question: "waiting",
  yourTurn: "waiting",
  done: "done",
  failed: "failed",
  stack: "failed",
  started: "started",
};

export function tableRowOf(event: PreviewEvent): TableEvent {
  return ROW_OF[event];
}
