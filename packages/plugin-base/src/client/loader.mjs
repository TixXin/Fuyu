import { Context } from "cordis";
import { HostBridge } from "./bridge.mjs";
import { Slots } from "./slots.mjs";

export function createLoader({ registry, base, bridge, importModule = (url) => import(/* @vite-ignore */ url), checkFile = defaultCheck, onStatus }) {
  const root = new Context();
  const ready = Promise.all([root.plugin(Slots, registry), bridge ? root.plugin(HostBridge, bridge) : null]);
  const inject = bridge ? ["slots", "host"] : ["slots"];
  const loaded = new Map();
  const status = new Map();

  const report = (id, value) => {
    status.set(id, value);
    onStatus?.(new Map(status));
  };

  async function load(entry) {
    const url = `${base}/${entry.path}?v=${encodeURIComponent(entry.version)}`;
    report(entry.id, { plugin: entry.plugin, state: "loading" });
    try {
      await checkFile(url);
      const module = await importModule(url);
      const plugin = module.default ?? module;
      const apply = typeof plugin === "function" ? plugin : plugin?.apply;
      if (typeof apply !== "function") throw new Error(`${entry.path} does not export a plugin (a function, or an object with apply)`);
      if (loaded.get(entry.id)?.entry !== entry) return;
      await ready;
      const fiber = root.plugin({ name: entry.plugin, inject, apply: (ctx) => apply(ctx) });
      loaded.set(entry.id, { entry, fiber });
      await fiber;
      report(entry.id, { plugin: entry.plugin, state: "running" });
    } catch (error) {
      report(entry.id, { plugin: entry.plugin, state: "failed", error: String(error?.message ?? error) });
    }
  }

  async function unload(id) {
    const current = loaded.get(id);
    loaded.delete(id);
    status.delete(id);
    onStatus?.(new Map(status));
    await current?.fiber?.dispose();
  }

  return {
    async sync(entries) {
      const wanted = new Map(entries.map((entry) => [entry.id, entry]));
      const tasks = [];
      for (const [id, current] of loaded) {
        const next = wanted.get(id);
        if (!next || next.version !== current.entry.version || next.path !== current.entry.path) tasks.push(unload(id));
      }
      await Promise.all(tasks);
      await Promise.all(
        [...wanted.values()]
          .filter((entry) => !loaded.has(entry.id))
          .map((entry) => {
            loaded.set(entry.id, { entry, fiber: null });
            return load(entry);
          }),
      );
    },
    status: () => new Map(status),
    stop: () => Promise.all([...loaded.keys()].map(unload)),
  };
}

async function defaultCheck(url) {
  const response = await fetch(url, { method: "HEAD" });
  if (response.ok && /javascript/.test(response.headers.get("content-type") ?? "")) return;
  if (response.status === 404) throw new Error(`the file is missing: ${url}`);
  throw new Error(`the file cannot be loaded as a module (${response.status} ${response.headers.get("content-type") ?? "no type"}): ${url}`);
}
