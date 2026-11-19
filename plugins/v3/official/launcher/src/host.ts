import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { islandApi } from "./island-api.ts";
import {
  METHODS,
  TOPICS,
  normalizeUsageMap,
  rankApps,
  recordAppLaunch,
  trimUsage,
  type AppEntry,
  type AppUsageMap,
  type LauncherState,
} from "./model.ts";
import { MAX_EXTRA_DIRS, normalizeSettings, type LauncherSettings } from "./settingsModel.ts";
import { defaultAppRoots, expandHome, launchApplication, scanApplications } from "./scanner.ts";

export const name = "@fuyu/launcher";
export const inject = ["clients", "commands"];

const STATE_FILE = "launcher.json";
const PAGE_ID = "@fuyu/launcher";
const COMMAND_TITLES = {
  open: { "zh-CN": "打开应用启动台", en: "Open App launcher" },
  rescan: { "zh-CN": "重新扫描应用", en: "Rescan apps" },
};

interface Stored {
  usage: AppUsageMap;
  settings: LauncherSettings;
}

function readStored(dataDir: string): Stored {
  try {
    const file = join(dataDir, STATE_FILE);
    if (!existsSync(file)) return { usage: {}, settings: normalizeSettings(null) };
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object" && ("usage" in parsed || "settings" in parsed)) {
      return { usage: normalizeUsageMap(parsed.usage), settings: normalizeSettings(parsed.settings) };
    }
    return { usage: normalizeUsageMap(parsed), settings: normalizeSettings(null) };
  } catch {
    return { usage: {}, settings: normalizeSettings(null) };
  }
}

function isDirectory(dir: string): boolean {
  try {
    readdirSync(dir, { withFileTypes: true });
    return true;
  } catch {
    return false;
  }
}

export function apply(ctx: Context) {
  const stored = readStored(ctx.dataDir);
  let scannedApps: AppEntry[] = [];
  let scannedAt = 0;

  function save(): void {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(join(ctx.dataDir, STATE_FILE), `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function scan(): void {
    const extra = stored.settings.extraDirs.map((dir) => expandHome(dir));
    scannedApps = scanApplications(defaultAppRoots(), process.platform, extra);
    scannedAt = Date.now();
  }

  function ensureScanned(): void {
    const minutes = stored.settings.rescanMinutes;
    if (scannedAt > 0 && (minutes === 0 || Date.now() - scannedAt < minutes * 60_000)) return;
    scan();
  }

  function snapshot(): LauncherState {
    const excluded = new Set(stored.settings.excluded);
    const visible = scannedApps.filter((app) => !excluded.has(app.path));
    const ranked = rankApps(visible, stored.settings.recordRecent ? stored.usage : {});
    let recentCount = 0;
    for (const item of ranked) {
      if (item.recent) recentCount += 1;
    }
    const byPath = new Map(scannedApps.map((app) => [app.path, app.name]));
    return {
      apps: ranked,
      excludedApps: stored.settings.excluded.map((path) => ({
        path,
        name: byPath.get(path) ?? path.split(/[\\/]/).pop()?.replace(/\.(app|lnk|url|exe)$/i, "") ?? path,
      })),
      totalCount: ranked.length,
      recentCount,
      scannedAt,
      updatedAt: Date.now(),
      settings: stored.settings,
    };
  }

  function publish(): LauncherState {
    const next = snapshot();
    ctx.clients.publish(TOPICS.state, next);
    return next;
  }

  function rescan(): LauncherState {
    scan();
    return publish();
  }

  scan();

  ctx.clients.handle(METHODS.getState, async () => {
    ensureScanned();
    return snapshot();
  });

  ctx.clients.handle(METHODS.rescan, async () => rescan());

  ctx.clients.handle(METHODS.launch, async (params?: { path?: string }) => {
    const targetPath = typeof params?.path === "string" ? params.path.trim() : "";
    if (!targetPath) {
      throw new Error("Application path is required");
    }
    let target = scannedApps.find((entry) => entry.path === targetPath);
    if (!target) {
      scan();
      target = scannedApps.find((entry) => entry.path === targetPath);
    }
    if (!target) {
      throw new Error("Application is no longer available");
    }
    if (process.env.FUYU_LAUNCHER_DRY_RUN !== "1") {
      launchApplication(target.path);
    }
    if (stored.settings.recordRecent) {
      const knownPaths = new Set(scannedApps.map((entry) => entry.path));
      stored.usage = recordAppLaunch(stored.usage, target.path, Date.now(), knownPaths, stored.settings.historyLimit);
      save();
    }
    return publish();
  });

  ctx.clients.handle(METHODS.clearRecent, async () => {
    stored.usage = {};
    save();
    return publish();
  });

  ctx.clients.handle(METHODS.setSettings, async (params?: Partial<LauncherSettings>) => {
    const prev = stored.settings;
    stored.settings = normalizeSettings({ ...prev, ...(params ?? {}) }, prev);
    stored.usage = trimUsage(stored.usage, stored.settings.historyLimit);
    save();
    if (prev.extraDirs.join("\n") !== stored.settings.extraDirs.join("\n")) scan();
    return publish();
  });

  ctx.clients.handle(METHODS.addExtraDir, async (params?: { dir?: string }) => {
    const dir = typeof params?.dir === "string" ? params.dir.trim() : "";
    if (!dir || !isDirectory(expandHome(dir))) throw new Error("missing-dir");
    if (!stored.settings.extraDirs.includes(dir) && stored.settings.extraDirs.length < MAX_EXTRA_DIRS) {
      stored.settings = { ...stored.settings, extraDirs: [...stored.settings.extraDirs, dir] };
      save();
      scan();
    }
    return publish();
  });

  ctx.commands.register("rescan", () => rescan(), { title: COMMAND_TITLES.rescan });

  const island = islandApi(ctx);
  if (island?.open) {
    const open = island.open.bind(island);
    ctx.commands.register("open", () => open(PAGE_ID), { title: COMMAND_TITLES.open });
  }
}
