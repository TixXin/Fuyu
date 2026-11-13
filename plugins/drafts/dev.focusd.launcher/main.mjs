import { spawn } from "node:child_process";
import { appFolders, findApps, folderLabel, launchCommand, noteLaunch, recentApps } from "./apps.mjs";
import { createPlugin } from "./lib/fuyu.mjs";

const VIEW = "apps";
const USAGE_KEY = "usage";
const RESCAN_AFTER_MS = 5 * 60 * 1000;

const plugin = createPlugin();
const folders = appFolders();
let apps = [];
let ids = new Map();
let scannedAt = 0;
let usage = null;
let recentCount = 6;

function readSettings(settings) {
  const count = Number(settings?.recentCount);
  recentCount = Number.isFinite(count) ? count : 6;
}

function scan(force = false) {
  if (!force && apps.length > 0 && Date.now() - scannedAt < RESCAN_AFTER_MS) return;
  apps = findApps(folders);
  ids = new Map(apps.map((app, index) => [`app-${index}`, app]));
  scannedAt = Date.now();
}

async function loadUsage() {
  usage ??= (await plugin.storage.get(USAGE_KEY)) ?? {};
  return usage;
}

function item(id, app) {
  const subtitle = folderLabel(app.path, folders);
  return { id, title: app.name, ...(subtitle ? { subtitle } : {}), icon: "rocket", action: "launch" };
}

async function show(force = false) {
  scan(force);
  const used = await loadUsage();
  const idOf = new Map([...ids].map(([id, app]) => [app.path, id]));
  const recent = recentApps(apps, used, recentCount);
  const groups = [];
  if (recent.length > 0) {
    groups.push({
      title: { "zh-CN": "最近用过", en: "Recent" },
      items: recent.map((app) => ({ ...item(`recent-${idOf.get(app.path)}`, app), icon: "clock" })),
    });
  }
  groups.push({
    title: { "zh-CN": `全部应用（${apps.length}）`, en: `All apps (${apps.length})` },
    items: apps.map((app) => item(idOf.get(app.path), app)),
  });
  await plugin.views.update(VIEW, {
    search: { placeholder: { "zh-CN": "搜索应用", en: "Search apps" }, mode: "local" },
    groups: apps.length > 0 ? groups : [],
    empty: { "zh-CN": "没有找到应用", en: "No apps found" },
  });
}

function start(app) {
  if (process.env.FUYU_LAUNCHER_DRY_RUN) {
    plugin.log(`would open ${app.path}`);
    return;
  }
  const command = launchCommand(app.path);
  if (!command) throw new Error(`Opening apps is not supported on ${process.platform}.`);
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", (error) => plugin.log(`could not open ${app.path}: ${error.message}`));
  child.unref();
  plugin.log(`opened ${app.path}`);
}

plugin.onReady((context) => readSettings(context.settings));

plugin.onSettingsChanged(async (settings) => {
  readSettings(settings);
  await show();
});

plugin.views.onVisible(VIEW, (visible) => (visible ? show() : undefined));

plugin.views.onAction(VIEW, async ({ actionId, itemId }) => {
  if (actionId !== "launch" || !itemId) return;
  const app = ids.get(itemId.replace(/^recent-/, ""));
  if (!app) {
    await show(true);
    return;
  }
  start(app);
  const known = new Set(apps.map((entry) => entry.path));
  usage = noteLaunch(await loadUsage(), app.path, Date.now(), known);
  await plugin.storage.set(USAGE_KEY, usage);
  await show();
});

plugin.onCommand("open", async () => {
  await show();
  if (plugin.hasCapability("openView")) await plugin.openView(VIEW);
});

plugin.onCommand("rescan", async () => {
  await show(true);
  plugin.log(`found ${apps.length} apps`);
});
