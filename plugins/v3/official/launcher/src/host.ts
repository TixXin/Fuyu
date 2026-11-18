import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import {
  METHODS,
  TOPICS,
  normalizeUsageMap,
  rankApps,
  recordAppLaunch,
  type AppEntry,
  type AppUsageMap,
  type LauncherState,
} from "./model.ts";
import { launchApplication, scanApplications } from "./scanner.ts";

export const name = "@fuyu/launcher";
export const inject = ["clients"];

const STATE_FILE = "launcher.json";
const RESCAN_TTL_MS = 5 * 60 * 1000;

interface StoredFile {
  usage?: unknown;
}

function readUsageFile(dataDir: string): AppUsageMap {
  try {
    const file = join(dataDir, STATE_FILE);
    if (!existsSync(file)) return {};
    const parsed = JSON.parse(readFileSync(file, "utf8")) as StoredFile;
    if (parsed && typeof parsed === "object" && "usage" in parsed) {
      return normalizeUsageMap(parsed.usage);
    }
    return normalizeUsageMap(parsed);
  } catch {
    return {};
  }
}

function writeUsageFile(dataDir: string, usage: AppUsageMap): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, STATE_FILE), `${JSON.stringify({ usage }, null, 2)}\n`, "utf8");
}

export function apply(ctx: Context) {
  let usage: AppUsageMap = readUsageFile(ctx.dataDir);
  let scannedApps: AppEntry[] = [];
  let scannedAt = 0;

  function ensureScanned(force = false): void {
    const now = Date.now();
    if (!force && scannedAt > 0 && now - scannedAt < RESCAN_TTL_MS) {
      return;
    }
    scannedApps = scanApplications();
    scannedAt = now;
  }

  function snapshot(): LauncherState {
    const ranked = rankApps(scannedApps, usage);
    let recentCount = 0;
    for (const item of ranked) {
      if (item.recent) recentCount += 1;
    }
    return {
      apps: ranked,
      totalCount: ranked.length,
      recentCount,
      scannedAt,
      updatedAt: Date.now(),
    };
  }

  function publish(): LauncherState {
    const next = snapshot();
    ctx.clients.publish(TOPICS.state, next);
    return next;
  }

  ensureScanned(true);

  ctx.clients.handle(METHODS.getState, async () => {
    ensureScanned(false);
    return snapshot();
  });

  ctx.clients.handle(METHODS.rescan, async () => {
    ensureScanned(true);
    return publish();
  });

  ctx.clients.handle(METHODS.launch, async (params?: { path?: string }) => {
    const targetPath = typeof params?.path === "string" ? params.path.trim() : "";
    if (!targetPath) {
      throw new Error("Application path is required");
    }
    ensureScanned(false);
    let target = scannedApps.find((entry) => entry.path === targetPath);
    if (!target) {
      ensureScanned(true);
      target = scannedApps.find((entry) => entry.path === targetPath);
    }
    if (!target) {
      throw new Error("Application is no longer available");
    }
    if (process.env.FUYU_LAUNCHER_DRY_RUN !== "1") {
      launchApplication(target.path);
    }
    const knownPaths = new Set(scannedApps.map((entry) => entry.path));
    usage = recordAppLaunch(usage, target.path, Date.now(), knownPaths);
    writeUsageFile(ctx.dataDir, usage);
    return publish();
  });

  ctx.clients.handle(METHODS.clearRecent, async () => {
    usage = {};
    writeUsageFile(ctx.dataDir, usage);
    return publish();
  });
}
