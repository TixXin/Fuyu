import { pluginId } from "./clients.mjs";
import { entryOf, installInjectableAccessor } from "./owner.mjs";
import { SOURCE } from "./sources.mjs";

function isAllowedTarget(url, declaredList) {
  const hostname = url.hostname.toLowerCase();
  const isLocal = (hostname === "localhost" || hostname === "127.0.0.1") && declaredList.includes("localhost");
  const hostAllowed =
    isLocal ||
    declaredList.includes(hostname) ||
    declaredList.some((pattern) => pattern.startsWith("*.") && hostname.endsWith(pattern.slice(1)) && hostname !== pattern.slice(2));
  if (!hostAllowed) return false;
  return url.protocol === "https:" || (url.protocol === "http:" && isLocal);
}

export class ControlledHttp {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    this.fetchImpl = fetchImpl;
    this.undeclared = new Map();
    this.watchers = new Set();
  }

  install(ctx) {
    const http = this;
    const offInit = ctx.on("loader/entry-init", (entry) => {
      const id = entry?.options?.id;
      if (id && this.undeclared.delete(id)) this.notifyWatchers();
    });
    const unaccess = installInjectableAccessor(ctx, "http", function () {
      const caller = this;
      return Object.freeze({
        fetch: (input, init) => http.fetch(caller, input, init),
      });
    });
    return () => {
      offInit();
      void unaccess();
    };
  }

  fetch(ctx, input, init) {
    const invoke = () => (init === undefined ? this.fetchImpl(input) : this.fetchImpl(input, init));
    const entry = entryOf(ctx);
    const meta = entry?.options?.[SOURCE];
    if (!meta || meta.source === "builtin" || !meta.declared) {
      return Promise.resolve().then(invoke);
    }
    let url;
    try {
      url = typeof input === "string" || input instanceof URL ? new URL(String(input)) : new URL(input.url);
    } catch (error) {
      return Promise.reject(error);
    }
    const hostname = url.hostname.toLowerCase();
    const declared = (meta.declared.network ?? []).map((item) => item.toLowerCase());
    if (!isAllowedTarget(url, declared)) {
      const id = entry.options.id ?? pluginId(ctx);
      let set = this.undeclared.get(id);
      if (!set) this.undeclared.set(id, (set = new Set()));
      const before = set.size;
      set.add(hostname);
      if (set.size !== before) this.notifyWatchers();
      return Promise.reject(
        Object.assign(new Error(`plugin ${id} fetched undeclared host ${hostname}`), {
          code: "undeclared-network",
          host: hostname,
        }),
      );
    }
    return Promise.resolve().then(invoke);
  }

  undeclaredOf(plugin) {
    return [...(this.undeclared.get(plugin) ?? [])];
  }

  watch(listener) {
    this.watchers.add(listener);
    return () => this.watchers.delete(listener);
  }

  notifyWatchers() {
    for (const listener of this.watchers) listener();
  }
}
