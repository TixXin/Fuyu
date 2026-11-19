import { pluginId } from "./clients.mjs";
import { kindOf } from "./gate.mjs";
import { entryOf, installInjectableAccessor } from "./owner.mjs";
import { serviceError } from "./services.mjs";

export const ISLAND_REQUEST_EVENT = "island.request";
export const ISLAND_WINDOW = "island";
export const ISLAND_TIMEOUT_MS = 10_000;
export const ISLAND_NOTICE_TIMEOUT_MS = 3_000;
const ACTIONS = new Set(["open", "collapse"]);

const goodPage = (page) => page === undefined || page === null || (typeof page === "string" && page !== "");
const goodName = (value) => typeof value === "string" && value !== "";
const ownedByApp = (caller) => kindOf(entryOf(caller)?.options) !== "third-party";

export class IslandControl {
  constructor({ timeoutMs = ISLAND_TIMEOUT_MS, noticeTimeoutMs = ISLAND_NOTICE_TIMEOUT_MS } = {}) {
    this.windows = null;
    this.pending = new Map();
    this.next = 0;
    this.timeoutMs = timeoutMs;
    this.noticeTimeoutMs = noticeTimeoutMs;
    this.noticeActions = new Set();
  }

  install(ctx) {
    const control = this;
    const unaccess = installInjectableAccessor(ctx, "island", function () {
      const caller = this;
      const open = (page) => control.request("open", pluginId(caller), page).then(() => undefined);
      if (!ownedByApp(caller)) return Object.freeze({ open });
      return Object.freeze({
        open,
        notify: (notice) => control.notify(notice),
        onNoticeAction: (listener) => {
          const off = control.onNoticeAction(listener);
          caller.effect(() => off, "island.onNoticeAction");
          return off;
        },
      });
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
    if (!goodName(plugin)) return Promise.reject(serviceError("bad-params", "the island needs the id of the calling plugin"));
    if (!goodPage(page)) return Promise.reject(serviceError("bad-params", "page must be the id of one of this plugin's island pages"));
    return this.send(page ? { action, plugin, page } : { action, plugin }, this.timeoutMs);
  }

  notify(notice) {
    if (!notice || typeof notice !== "object" || !goodName(notice.pluginId)) return Promise.resolve(false);
    return this.send({ action: "notify", plugin: notice.pluginId, notice }, this.noticeTimeoutMs).then(
      (shown) => shown === true,
      () => false,
    );
  }

  send(payload, timeoutMs) {
    if (!this.windows?.connected().includes(ISLAND_WINDOW)) return Promise.reject(serviceError("not-ready", "the island window is not connected"));
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.finish(id, null, serviceError("timeout", `the island did not answer ${payload.action} within ${timeoutMs} ms`)), timeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
      this.windows.publish(ISLAND_REQUEST_EVENT, { id, ...payload });
    });
  }

  settle(params, window) {
    if (window !== ISLAND_WINDOW) throw serviceError("bad-params", "only the island window answers island requests");
    const error = params?.error;
    return this.finish(params?.id, params?.value ?? null, error ? serviceError(typeof error.code === "string" && error.code ? error.code : "failed", String(error.message ?? "the island could not do it")) : null);
  }

  onNoticeAction(listener) {
    if (typeof listener !== "function") throw new TypeError("a notice action listener must be a function");
    const entry = (data) => listener(data);
    this.noticeActions.add(entry);
    return () => void this.noticeActions.delete(entry);
  }

  noticeAction(params, window) {
    if (window !== ISLAND_WINDOW) throw serviceError("bad-params", "only the island window reports notice actions");
    if (!goodName(params?.pluginId) || !goodName(params?.action)) throw serviceError("bad-params", "a notice action needs { pluginId, action }");
    const data = Object.freeze({ pluginId: params.pluginId, action: params.action });
    for (const listener of [...this.noticeActions]) listener(data);
    return true;
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
