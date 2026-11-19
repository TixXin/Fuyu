import { pluginId } from "./clients.mjs";
import { installInjectableAccessor } from "./owner.mjs";
import { serviceError } from "./services.mjs";

export const ISLAND_REQUEST_EVENT = "island.request";
export const ISLAND_WINDOW = "island";
export const ISLAND_TIMEOUT_MS = 10_000;
const ACTIONS = new Set(["open", "collapse"]);

const goodPage = (page) => page === undefined || page === null || (typeof page === "string" && page !== "");

export class IslandControl {
  constructor({ timeoutMs = ISLAND_TIMEOUT_MS } = {}) {
    this.windows = null;
    this.pending = new Map();
    this.next = 0;
    this.timeoutMs = timeoutMs;
  }

  install(ctx) {
    const control = this;
    const unaccess = installInjectableAccessor(ctx, "island", function () {
      const caller = this;
      return Object.freeze({ open: (page) => control.request("open", pluginId(caller), page).then(() => undefined) });
    });
    return () => void unaccess();
  }

  attachWindows(windows) {
    this.windows = windows;
    return () => {
      if (this.windows !== windows) return;
      this.windows = null;
      for (const id of [...this.pending.keys()]) this.finish(id, null, serviceError("peer-gone", "the island window went away before it answered"));
    };
  }

  request(action, plugin, page) {
    if (!ACTIONS.has(action)) return Promise.reject(serviceError("bad-params", `the island cannot ${action}`));
    if (typeof plugin !== "string" || plugin === "") return Promise.reject(serviceError("bad-params", "the island needs the id of the calling plugin"));
    if (!goodPage(page)) return Promise.reject(serviceError("bad-params", "page must be the id of one of this plugin's island pages"));
    if (!this.windows?.connected().includes(ISLAND_WINDOW)) return Promise.reject(serviceError("not-ready", "the island window is not connected"));
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.finish(id, null, serviceError("timeout", `the island did not answer ${action} within ${this.timeoutMs} ms`)), this.timeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      this.windows.publish(ISLAND_REQUEST_EVENT, page ? { id, action, plugin, page } : { id, action, plugin });
    });
  }

  settle(params, window) {
    if (window !== ISLAND_WINDOW) throw serviceError("bad-params", "only the island window answers island requests");
    const error = params?.error;
    return this.finish(params?.id, params?.value ?? null, error ? serviceError(typeof error.code === "string" && error.code ? error.code : "failed", String(error.message ?? "the island could not do it")) : null);
  }

  finish(id, value, error) {
    const call = this.pending.get(id);
    if (!call) return false;
    this.pending.delete(id);
    clearTimeout(call.timer);
    if (error) call.reject(error);
    else call.resolve(value);
    return true;
  }
}
