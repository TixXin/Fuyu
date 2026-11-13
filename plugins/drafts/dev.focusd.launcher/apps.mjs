import { readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const MAX_APPS = 480;
const MAX_DEPTH = 3;
const SKIPPED = /uninstall|卸载|readme|help|帮助|license|website|网站/i;

export function appFolders(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.FUYU_LAUNCHER_APP_DIRS) return env.FUYU_LAUNCHER_APP_DIRS.split(path.delimiter).filter(Boolean);
  if (platform === "darwin") {
    return ["/Applications", "/System/Applications", path.join(home, "Applications")];
  }
  if (platform === "win32") {
    const menus = "Microsoft\\Windows\\Start Menu\\Programs";
    return [env.APPDATA && path.join(env.APPDATA, menus), env.ProgramData && path.join(env.ProgramData, menus)].filter(Boolean);
  }
  return [];
}

export function appExtension(platform = process.platform) {
  return platform === "win32" ? ".lnk" : ".app";
}

function walk(folder, extension, depth, found) {
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(folder, entry.name);
    if (entry.name.toLowerCase().endsWith(extension)) {
      const bundle = extension === ".app";
      if (bundle ? entry.isDirectory() || entry.isSymbolicLink() : entry.isFile()) {
        found.push({ name: entry.name.slice(0, -extension.length), path: full });
      }
      continue;
    }
    if (entry.isDirectory() && depth < MAX_DEPTH) walk(full, extension, depth + 1, found);
  }
}

export function findApps(folders, extension = appExtension()) {
  const found = [];
  for (const folder of folders) walk(folder, extension, 1, found);
  const byName = new Map();
  for (const app of found) {
    const key = app.name.toLowerCase();
    if (SKIPPED.test(app.name) || byName.has(key)) continue;
    byName.set(key, app);
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" })).slice(0, MAX_APPS);
}

export function recentApps(apps, usage, count) {
  return apps
    .filter((app) => usage[app.path])
    .sort((left, right) => usage[right.path].last - usage[left.path].last)
    .slice(0, Math.max(0, count));
}

export function noteLaunch(usage, appPath, now, known) {
  const next = {};
  for (const [key, value] of Object.entries(usage)) {
    if (known.has(key)) next[key] = value;
  }
  next[appPath] = { count: (usage[appPath]?.count ?? 0) + 1, last: now };
  return next;
}

export function launchCommand(appPath, platform = process.platform) {
  if (platform === "darwin") return ["/usr/bin/open", [appPath]];
  if (platform === "win32") return ["explorer.exe", [appPath]];
  return null;
}

export function folderLabel(appPath, folders) {
  const folder = folders.find((root) => appPath.startsWith(root + path.sep));
  if (!folder) return "";
  const inside = path.dirname(appPath).slice(folder.length + 1);
  return inside.split(path.sep).filter(Boolean).join(" / ");
}
