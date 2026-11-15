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

export class Clients extends Service {
  constructor(ctx, root) {
    super(ctx, "clients");
    this.root = realpathSync(root);
    this.entries = new Map();
    this.listeners = new Set();
    this.next = 0;
  }

  add(window, url) {
    if (!WINDOW.test(window)) throw new TypeError(`${window} is not a window name`);
    const file = real(fileURLToPath(url));
    const path = relative(this.root, file).split(sep).join("/");
    if (!path || path.startsWith("../") || path === ".." || /^[a-zA-Z]:/.test(path)) {
      throw new Error(`the window code at ${file} must be inside the plugin folder ${this.root}`);
    }
    const stat = statSync(file);
    const plugin = this.ctx.fiber.name;
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
