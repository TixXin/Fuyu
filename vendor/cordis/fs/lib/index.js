var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { Service } from "cordis";

// src/error.ts
var FsError = class extends Error {
  constructor(code, url, message) {
    super(message);
    this.code = code;
    this.url = url;
  }
  code;
  url;
  static {
    __name(this, "FsError");
  }
  name = "FsError";
};

// src/watcher.ts
var Watcher = class {
  /** `connect` starts serving the watch, and returns a function that disposes it. */
  constructor(ctx, url, options, connect) {
    this.ctx = ctx;
    this.url = url;
    this.options = options;
    this.dispose = ctx.effect(() => {
      const disconnect = connect(this);
      return () => {
        this._closed = true;
        return disconnect();
      };
    }, "ctx.fs.watch()");
  }
  ctx;
  url;
  options;
  static {
    __name(this, "Watcher");
  }
  _hooks = { change: /* @__PURE__ */ new Set(), ready: /* @__PURE__ */ new Set(), error: /* @__PURE__ */ new Set() };
  _ready = false;
  _closed = false;
  /** Ends the watch. */
  dispose;
  /** Adds a listener, and returns a function that removes it. */
  on(name, listener) {
    const hooks = this._hooks[name];
    const hook = { listener };
    hooks.add(hook);
    if (name === "ready" && this._ready) {
      queueMicrotask(() => {
        if (!hook.removed) this._call(listener, []);
      });
    }
    return () => {
      hook.removed = true;
      hooks.delete(hook);
    };
  }
  /**
   * Reports an event, as the provider that serves the watch does. Only the
   * first `ready` is dispatched, so a provider that takes over the watch does
   * not report it again.
   */
  emit(name, ...args) {
    if (this._closed) return;
    if (name === "error") return this._error(args[0]);
    if (name === "ready") {
      if (this._ready) return;
      this._ready = true;
    }
    this._dispatch(name, args);
  }
  // An event reaches the hooks taken when it is dispatched.
  _dispatch(name, args) {
    for (const hook of [...this._hooks[name]]) {
      if (!hook.removed) this._call(hook.listener, args);
    }
  }
  _call(listener, args) {
    (async () => listener(...args))().catch((error) => this._error(error));
  }
  _error(error) {
    if (this._closed) return;
    const hooks = this._hooks.error;
    if (!hooks.size) return this.ctx.logger.warn(error);
    for (const hook of [...hooks]) {
      if (hook.removed) continue;
      (async () => hook.listener(error))().catch((error2) => this.ctx.logger.warn(error2));
    }
  }
};

// src/index.ts
function normalizePrefix(prefix) {
  if (typeof prefix === "string" && /^[a-zA-Z][a-zA-Z\d+.-]*:$/.test(prefix)) {
    return prefix.toLowerCase();
  }
  const { href } = new URL(prefix);
  return href.endsWith("/") ? href : href + "/";
}
__name(normalizePrefix, "normalizePrefix");
var Fs = class extends Service {
  static {
    __name(this, "Fs");
  }
  _mounts = /* @__PURE__ */ new Map();
  /** the connection that serves each watch, if any */
  _watchers = /* @__PURE__ */ new Map();
  constructor(ctx) {
    super(ctx, "fs");
  }
  /**
   * Mount a provider at a scheme, such as `s3:`, or at a URL, such as
   * `file:///`. A location goes to the provider of the longest prefix that
   * contains it. The mount ends with the calling fiber.
   *
   * Every watch follows the routing: a change of the mounts moves it to the
   * provider its location goes to, and a watch without a provider is resumed
   * once one is mounted. Changes while a watch has no provider are not reported.
   */
  mount(prefix, provider) {
    const key = normalizePrefix(prefix);
    return this.ctx.effect(() => {
      if (this._mounts.has(key)) {
        throw new Error(`a provider is already mounted at ${key}`);
      }
      this._mounts.set(key, { prefix: key, provider });
      this._reroute();
      return () => {
        this._mounts.delete(key);
        return this._reroute();
      };
    }, "ctx.fs.mount()");
  }
  /** Resolve a URL reference against `ctx.baseUrl`. */
  resolve(path) {
    if (path instanceof URL) return path;
    const base = this.ctx.baseUrl;
    if (!base && !URL.canParse(path)) {
      throw new TypeError(`cannot resolve the relative reference ${JSON.stringify(path)} without ctx.baseUrl`);
    }
    return new URL(path, base);
  }
  _match(url) {
    let result;
    for (const mount of this._mounts.values()) {
      const matches = mount.prefix.endsWith(":") ? url.protocol === mount.prefix : url.href.startsWith(mount.prefix) || url.href + "/" === mount.prefix;
      if (matches && (!result || mount.prefix.length > result.prefix.length)) result = mount;
    }
    return result;
  }
  _route(url) {
    const mount = this._match(url);
    if (!mount) throw new FsError("NoProvider", url, `no provider is mounted for ${url.href}`);
    return mount;
  }
  _connect(watcher, mount) {
    const { provider, prefix } = mount;
    if (!provider.watch) {
      throw new FsError("NotSupported", watcher.url, `the provider mounted at ${prefix} does not support watch()`);
    }
    const dispose = provider.watch(watcher);
    this._watchers.set(watcher, { mount, dispose });
  }
  // The provider watch is disposed at once, and reports no more events.
  async _disconnect(watcher) {
    const connection = this._watchers.get(watcher);
    if (!connection) return;
    this._watchers.set(watcher, void 0);
    await connection.dispose();
  }
  _reroute() {
    const stops = [];
    for (const [watcher, connection] of this._watchers) {
      const mount = this._match(watcher.url);
      if (mount === connection?.mount) continue;
      stops.push(this._disconnect(watcher).catch((error) => watcher.emit("error", error)));
      if (!mount) {
        this.ctx.logger.debug("watch of %s is suspended without a provider", watcher.url.href);
        continue;
      }
      try {
        this._connect(watcher, mount);
      } catch (error) {
        watcher.emit("error", error);
      }
    }
    return Promise.all(stops).then(() => {
    });
  }
  /** Watch a file or a directory. The watch ends with the calling fiber. */
  watch(path, options = {}) {
    const url = this.resolve(path);
    const mount = this._route(url);
    return new Watcher(this.ctx, url, options, (watcher) => {
      this._connect(watcher, mount);
      return async () => {
        const connection = this._watchers.get(watcher);
        this._watchers.delete(watcher);
        await connection?.dispose();
      };
    });
  }
};
var BaseFs = class {
  constructor(ctx, config = {}) {
    this.ctx = ctx;
    const mount = config.mount ?? new.target.mount;
    if (!mount) throw new TypeError("expected a mount point in the config");
    ctx.fs.mount(mount, this);
  }
  ctx;
  static {
    __name(this, "BaseFs");
  }
  static inject = ["fs"];
  /** The default mount point of the subclass. */
  static mount;
};
var index_default = Fs;
export {
  BaseFs,
  Fs,
  FsError,
  Watcher,
  index_default as default
};
