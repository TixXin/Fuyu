import { realpathSync, statSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Service } from "cordis";

const WINDOW = /^[a-z][a-z0-9-]{0,63}$/;

function real(file) {
  try {
    return realpathSync(file);
  } catch {
    try {
      return join(realpathSync(dirname(file)), basename(file));
    } catch {
      return file;
    }
  }
}

export function pluginId(ctx) {
  for (let fiber = ctx.fiber; fiber; ) {
    if (fiber.entry) return fiber.entry.options.id;
    const parent = fiber.parent?.fiber;
    if (!parent || parent === fiber) break;
    fiber = parent;
  }
  return ctx.fiber.name;
}

function within(dir, file) {
  const path = relative(dir, file).split(sep).join("/");
  return !path || path.startsWith("../") || path === ".." || /^[a-zA-Z]:/.test(path) ? null : path;
}

export class Clients extends Service {
  constructor(ctx, options) {
    super(ctx, "clients");
    const { root, mounts = [] } = typeof options === "string" ? { root: options } : options;
    this.root = realpathSync(root);
    this.mounts = mounts.map(({ prefix, dir }) => ({ prefix, dir: real(dir) }));
    this.entries = new Map();
    this.listeners = new Set();
    this.handlers = new Map();
    this.messages = new Set();
    this.next = 0;
  }

  handle(method, handler) {
    if (typeof method !== "string" || !method) throw new TypeError("a window method needs a name");
    const key = `${pluginId(this.ctx)}/${method}`;
    return this.ctx.effect(() => {
      if (this.handlers.has(key)) throw new Error(`${key} is already handled`);
      this.handlers.set(key, handler);
      return () => this.handlers.delete(key);
    }, `ctx.clients.handle(${method})`);
  }

  async call(plugin, method, params, window) {
    const handler = this.handlers.get(`${plugin}/${method}`);
    if (!handler) throw Object.assign(new Error(`the plugin ${plugin} has no window method ${method}`), { code: "no-method" });
    return handler(params, { window });
  }

  publish(topic, data) {
    const message = { plugin: pluginId(this.ctx), topic, data };
    for (const listener of this.messages) listener(message);
  }

  onMessage(listener) {
    this.messages.add(listener);
    return () => this.messages.delete(listener);
  }

  add(window, url) {
    if (!WINDOW.test(window)) throw new TypeError(`${window} is not a window name`);
    const file = real(fileURLToPath(url));
    const path = this.locate(file);
    if (!path) throw new Error(`the window code at ${file} must be inside the plugin folder ${this.root}`);
    const stat = statSync(file);
    const plugin = pluginId(this.ctx);
    const id = `${plugin}#${++this.next}`;
    return this.ctx.effect(() => {
      this.entries.set(id, { id, plugin, window, path, version: `${stat.size}-${Math.round(stat.mtimeMs)}` });
      this.changed();
      return () => {
        this.entries.delete(id);
        this.changed();
      };
    }, "ctx.clients.add()");
  }

  locate(file) {
    for (const { prefix, dir } of this.mounts) {
      const path = within(dir, file);
      if (path) return `${prefix}/${path}`;
    }
    return within(this.root, file);
  }

  list(window) {
    return [...this.entries.values()].filter((entry) => !window || entry.window === window);
  }

  watch(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  changed() {
    for (const listener of this.listeners) listener(this.list());
  }
}
