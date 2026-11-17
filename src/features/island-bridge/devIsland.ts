import { emit } from "@tauri-apps/api/event";
import { DEV_ISLAND_ACTION_EVENT } from "./api";
import type { LocalApiHandlers } from "./dispatch";

const ACTIONS = new Set(["open", "collapse", "tuck", "reveal"]);

function record(params: unknown): Record<string, unknown> {
  return params && typeof params === "object" ? (params as Record<string, unknown>) : {};
}

export const devIslandHandlers: LocalApiHandlers = {
  "devIsland.emit": async (params) => {
    const { event, payload } = record(params);
    if (typeof event !== "string" || event.length === 0) {
      return { ok: false, status: 400, error: "Give the event name in \"event\"." };
    }
    await emit(event, payload ?? null);
    return { ok: true, data: { emitted: event } };
  },
  "devIsland.action": async (params) => {
    const action = record(params);
    if (typeof action.action !== "string" || !ACTIONS.has(action.action)) {
      return { ok: false, status: 400, error: "\"action\" must be open, collapse, tuck or reveal." };
    }
    if (action.action === "open" && typeof action.page !== "string") {
      return { ok: false, status: 400, error: "Opening needs a \"page\"." };
    }
    await emit(DEV_ISLAND_ACTION_EVENT, action);
    return { ok: true, data: { action: action.action } };
  },
};
