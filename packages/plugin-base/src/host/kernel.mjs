import { realpathSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import Fs from "@cordisjs/fs";
import NodeFs from "@cordisjs/fs-node";
import Loader from "@cordisjs/loader";
import { Context } from "cordis";
import { HOST_SHARED_MODULES } from "../protocol.mjs";
import { builtinMounts, readBuiltins } from "./builtins.mjs";
import { Clients } from "./clients.mjs";
import { DATA_DIR, installDataDir } from "./data.mjs";
import { DEV_WATCHED, watchBuiltins } from "./reload.mjs";
import { Services } from "./services.mjs";
import { DEV_PREFIX, SOURCE } from "./sources.mjs";
import { recordLogs } from "./logs.mjs";
import { RustBridge } from "./rust.mjs";
import { shareModules } from "./share.mjs";
import { Gate } from "./gate.mjs";
import { Timers } from "./timer.mjs";
import { INTERNAL, pluginStatus, trackImportErrors, watchStatus } from "./status.mjs";
import { Usage } from "./usage.mjs";

const API = new URL("../index.mjs", import.meta.url).href;
export const PLUGINS_FILE = new URL("./plugins-file.mjs", import.meta.url).href;
export const HMR = import.meta.resolve("@cordisjs/hmr");
const REREAD_AFTER_MS = [50, 400];
const ACTIVE = 2;

async function watchConfig(ctx, id) {
  const include = [...ctx.loader.entries()].find((entry) => entry.id === id)?.subtree;
  if (!include?.filename) throw new Error("the plugin configuration did not load, so it cannot be watched");
  const watcher = ctx.fs.watch(pathToFileURL(include.filename));
  let pending = [];
  const reread = () => {
    pending.forEach(clearTimeout);
    pending = REREAD_AFTER_MS.map((ms) => setTimeout(() => include.refresh(), ms));
  };
  ctx.effect(() => () => pending.forEach(clearTimeout), "plugin configuration rereads");
  watcher.on("change", reread);
  await new Promise((resolve) => watcher.on("ready", resolve));
  await include.refresh();
}

function sourcesOf(ctx) {
  return () =>
    [...ctx.loader.entries()].flatMap((entry) => {
      const meta = entry.options[SOURCE];
      if (!meta?.root || meta.rejected) return [];
      const { id } = entry.options;
      const prefix = meta.source === "dev" ? `${DEV_PREFIX}/${id}` : null;
      return [{ id, dir: meta.root, prefix, clients: meta.clients ?? [], active: entry.innerFiber?.state === ACTIVE }];
    });
}

function hostInfo(startedAt, safe, dev) {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return { pid: process.pid, node: process.versions.node, startedAt, safe, dev, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, cpuMs: Math.round((cpu.user + cpu.system) / 1000) };
}

export async function startHost({ dir, config = "plugins.yml", builtins = null, dataDir = null, appVersion = null, apiNames = [], watch = false, dev = false, safe = null, faultLimit, onLog, rpc = null } = {}) {
  if (!dir) throw new Error("startHost needs the directory that holds the plugin configuration");
  const startedAt = Date.now();
  const catalog = builtins ? readBuiltins(builtins) : null;
  const gate = new Gate({ safe, limit: faultLimit, internal: INTERNAL });
  shareModules(Object.fromEntries([...HOST_SHARED_MODULES, ...apiNames].map((name) => [name, API])));
  const ctx = new Context();
  const logs = recordLogs(ctx, onLog);
  ctx.baseUrl = pathToFileURL(dir.endsWith(sep) ? dir : dir + sep).href;
  await ctx.use(Fs);
  await ctx.use(NodeFs);
  const usage = new Usage((plugin, error) => gate.fault(plugin, error));
  usage.install(ctx);
  const timers = new Timers(usage);
  timers.install(ctx);
  installDataDir(ctx, dataDir ?? join(dir, DATA_DIR));
  await ctx.plugin(Clients, { root: dir, mounts: builtinMounts(catalog) });
  const services = new Services();
  services.install(ctx);
  const rust = new RustBridge();
  rust.install(ctx);
  if (rpc) rust.attach(rpc);
  await ctx.use(Loader);
  trackImportErrors(ctx);
  gate.install(ctx);
  ctx.clients.useSources(sourcesOf(ctx));
  if (dev) {
    await ctx.loader.create({ name: HMR, config: { base: realpathSync(dir), watch: { enabled: true, debounce: 30, files: DEV_WATCHED } } });
    watchBuiltins(ctx, catalog);
  }
  const id = await ctx.loader.create({ name: PLUGINS_FILE, config: { path: config, builtins: catalog?.plugins ?? [], dir, appVersion } });
  if (watch) await watchConfig(ctx, id);
  const report = () => usage.report(ctx, timers.counts(), (plugin) => gate.report(plugin));
  const extras = {
    gate,
    usage: report,
    services: () => services.list(),
    clients: () => ctx.clients.list(),
    subscribe: (listener) => [services.watch(listener), ctx.clients.watch(listener)],
  };
  return {
    ctx,
    logs,
    status: () => pluginStatus(ctx, logs, extras),
    watchStatus: (onChange, tickMs = 0) => watchStatus(ctx, logs, onChange, { ...extras, tickMs }),
    info: () => hostInfo(startedAt, safe, dev),
    builtins: () => catalog?.plugins.map(({ id, kind }) => ({ id, kind })) ?? [],
    fault: (plugin, error) => gate.fault(plugin, error),
    clients: (window) => ctx.clients.list(window),
    timers: () => timers.counts(),
    watchClients: (onChange) => ctx.clients.watch(onChange),
    serviceHub: services,
    services: () => services.list(),
    watchServices: (onChange) => services.watch(onChange),
    settle: () => Promise.all(ctx.loader.getTasks()),
    stop: () => ctx.fiber.dispose(),
  };
}
