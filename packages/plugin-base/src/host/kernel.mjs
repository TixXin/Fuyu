import { sep } from "node:path";
import { pathToFileURL } from "node:url";
import Fs from "@cordisjs/fs";
import NodeFs from "@cordisjs/fs-node";
import Loader from "@cordisjs/loader";
import { Context } from "cordis";
import { recordLogs } from "./logs.mjs";
import { shareModules } from "./share.mjs";
import { pluginStatus, watchStatus } from "./status.mjs";

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

export async function startHost({ dir, config = "plugins.yml", apiNames = [], watch = false, onLog } = {}) {
  if (!dir) throw new Error("startHost needs the directory that holds the plugin configuration");
  shareModules(Object.fromEntries(["@fuyu/plugin-base", ...apiNames].map((name) => [name, API])));
  const ctx = new Context();
  const logs = recordLogs(ctx, onLog);
  ctx.baseUrl = pathToFileURL(dir.endsWith(sep) ? dir : dir + sep).href;
  await ctx.use(Fs);
  await ctx.use(NodeFs);
  await ctx.use(Loader);
  const id = await ctx.loader.create({ name: INCLUDE, config: { path: config } });
  if (watch) await watchConfig(ctx, id);
  return {
    ctx,
    logs,
    status: () => pluginStatus(ctx, logs),
    watchStatus: (onChange) => watchStatus(ctx, logs, onChange),
    settle: () => Promise.all(ctx.loader.getTasks()),
    stop: () => ctx.fiber.dispose(),
  };
}
