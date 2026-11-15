import { realpathSync } from "node:fs";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import Fs from "@cordisjs/fs";
import NodeFs from "@cordisjs/fs-node";
import Loader from "@cordisjs/loader";
import { Context } from "cordis";
import { Clients } from "./clients.mjs";
import { Services } from "./services.mjs";
import { recordLogs } from "./logs.mjs";
import { shareModules } from "./share.mjs";
import { Gate } from "./gate.mjs";
import { Timers } from "./timer.mjs";
import { INTERNAL, pluginStatus, watchStatus } from "./status.mjs";
import { Usage } from "./usage.mjs";

const API = new URL("../index.mjs", import.meta.url).href;
export const INCLUDE = import.meta.resolve("@cordisjs/include");
export const HMR = import.meta.resolve("@cordisjs/hmr");
const REREAD_AFTER_MS = [50, 400];

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

function hostInfo(startedAt, safe, dev) {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return { pid: process.pid, node: process.versions.node, startedAt, safe, dev, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, cpuMs: Math.round((cpu.user + cpu.system) / 1000) };
}

export async function startHost({ dir, config = "plugins.yml", apiNames = [], watch = false, dev = false, safe = null, faultLimit, onLog } = {}) {
  if (!dir) throw new Error("startHost needs the directory that holds the plugin configuration");
  const startedAt = Date.now();
  const gate = new Gate({ safe, limit: faultLimit, internal: INTERNAL });
  shareModules(Object.fromEntries(["@fuyu/plugin-base", ...apiNames].map((name) => [name, API])));
  const ctx = new Context();
  const logs = recordLogs(ctx, onLog);
  ctx.baseUrl = pathToFileURL(dir.endsWith(sep) ? dir : dir + sep).href;
  await ctx.use(Fs);
  await ctx.use(NodeFs);
  const usage = new Usage((plugin, error) => gate.fault(plugin, error));
  usage.install(ctx);
  const timers = new Timers(usage);
  timers.install(ctx);
  await ctx.plugin(Clients, dir);
  const services = new Services();
  services.install(ctx);
  await ctx.use(Loader);
  gate.install(ctx);
  if (dev) await ctx.loader.create({ name: HMR, config: { base: realpathSync(dir), watch: { enabled: true, debounce: 30 } } });
  const id = await ctx.loader.create({ name: INCLUDE, config: { path: config } });
  if (watch) await watchConfig(ctx, id);
  const report = () => usage.report(ctx, timers.counts(), (plugin) => gate.report(plugin));
  const extras = { gate, usage: report };
  return {
    ctx,
    logs,
    status: () => pluginStatus(ctx, logs, extras),
    watchStatus: (onChange, tickMs = 0) => watchStatus(ctx, logs, onChange, { ...extras, tickMs }),
    info: () => hostInfo(startedAt, safe, dev),
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
