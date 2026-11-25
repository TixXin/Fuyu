import { Context, Service } from "cordis";
import { HostBridge } from "./bridge.mjs";
import { PluginIsland } from "./island-service.mjs";
import { PluginSettings } from "./settings-service.mjs";
import { Slots } from "./slot-service.mjs";

class PluginServices extends Service {
  constructor(ctx, proxy) {
    super(ctx, "services");
    this.proxy = proxy;
  }

  get(definition) {
    return this.proxy.get(definition);
  }

  list() {
    return this.proxy.list();
  }

  has(name) {
    return this.proxy.has(name);
  }

  watch(watcher) {
    return this.ctx.effect(() => this.proxy.watch(watcher), "ctx.services.watch()");
  }
}

export function createLoader({
  registry,
  base,
  bridge,
  connectPlugin = null,
  openSettings = null,
  reportSetup = null,
  island = null,
  importModule = (url) => import(/* @vite-ignore */ url),
  checkFile = defaultCheck,
  onStatus,
}) {
  const root = new Context();
  const ready = Promise.all([root.plugin(Slots, registry), root.plugin(PluginSettings, { open: openSettings, setup: reportSetup }), root.plugin(PluginIsland, { control: island }), bridge ? root.plugin(HostBridge, bridge) : null]);
  const baseInject = bridge ? ["slots", "settings", "island", "host"] : ["slots", "settings", "island"];
  const loaded = new Map();
  const status = new Map();

  const report = (id, value) => {
    status.set(id, value);
    onStatus?.(new Map(status));
  };

  async function mountContext(entry) {
    if (!connectPlugin) {
      await ready;
      return { host: root, inject: baseInject, close: null };
    }
    const scoped = connectPlugin(entry);
    if (!scoped) {
      await ready;
      return { host: root, inject: baseInject, close: null };
    }
    const isolated = new Context();
    const tasks = [
      isolated.plugin(Slots, registry),
      isolated.plugin(PluginSettings, { open: openSettings, setup: reportSetup }),
      isolated.plugin(PluginIsland, { control: island }),
    ];
    const inject = ["slots", "settings", "island"];
    const pluginBridge = scoped.bridge ?? bridge;
    if (pluginBridge) {
      tasks.push(isolated.plugin(HostBridge, pluginBridge));
      inject.push("host");
    }
    if (scoped.services) {
      tasks.push(isolated.plugin(PluginServices, scoped.services));
      inject.push("services");
    }
    await Promise.all(tasks);
    return {
      host: isolated,
      inject,
      close: async () => {
        await isolated.fiber.dispose();
        scoped.close?.();
      },
    };
  }

  async function load(entry) {
    const url = `${base}/${entry.path}?v=${encodeURIComponent(entry.version)}`;
    report(entry.id, { plugin: entry.plugin, state: "loading" });
    let mounted = null;
    try {
      await checkFile(url);
      const module = await importModule(url);
      const plugin = module.default ?? module;
      const apply = typeof plugin === "function" ? plugin : plugin?.apply;
      if (typeof apply !== "function") throw new Error(`${entry.path} does not export a plugin (a function, or an object with apply)`);
      if (loaded.get(entry.id)?.entry !== entry) return;
      mounted = await mountContext(entry);
      if (loaded.get(entry.id)?.entry !== entry) {
        await mounted.close?.();
        return;
      }
      const fiber = mounted.host.plugin({ name: entry.plugin, inject: mounted.inject, apply: (ctx) => apply(ctx) });
      loaded.set(entry.id, { entry, fiber, close: mounted.close });
      await fiber;
      report(entry.id, { plugin: entry.plugin, state: "running" });
    } catch (error) {
      await mounted?.close?.();
      report(entry.id, { plugin: entry.plugin, state: "failed", error: String(error?.message ?? error) });
    }
  }

  async function unload(id) {
    const current = loaded.get(id);
    loaded.delete(id);
    status.delete(id);
    onStatus?.(new Map(status));
    await current?.fiber?.dispose();
    await current?.close?.();
  }

  return {
    async sync(entries) {
      const wanted = new Map(entries.map((entry) => [entry.id, entry]));
      const tasks = [];
      for (const [id, current] of loaded) {
        const next = wanted.get(id);
        if (!next || next.version !== current.entry.version || next.path !== current.entry.path || next.token !== current.entry.token) tasks.push(unload(id));
      }
      await Promise.all(tasks);
      await Promise.all(
        [...wanted.values()]
          .filter((entry) => !loaded.has(entry.id))
          .map((entry) => {
            loaded.set(entry.id, { entry, fiber: null, close: null });
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
