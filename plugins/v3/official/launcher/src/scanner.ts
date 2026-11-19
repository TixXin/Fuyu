import { spawn, type SpawnOptions } from "node:child_process";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, posix, sep, win32 } from "node:path";
import type { AppEntry } from "./model.ts";

export const MAX_SCANNED_APPS = 500;
const MAX_WALK_DEPTH = 3;
const NOISE_NAME = /uninstall|卸载|readme|help|帮助|license|website|网站/i;

export interface LaunchSpec {
  command: string;
  args: string[];
  options: SpawnOptions;
}

export function defaultAppRoots(
  platform: string = process.platform,
  env: Record<string, string | undefined> = process.env,
  home: string = homedir(),
): string[] {
  const override = env.FUYU_LAUNCHER_APP_DIRS;
  if (override && override.trim()) {
    return override
      .split(delimiter)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (platform === "darwin") {
    const systemApps = posix.join("/", "System", "Applications");
    return [
      posix.join("/", "Applications"),
      systemApps,
      posix.join(systemApps, "Utilities"),
      posix.join(home, "Applications"),
    ];
  }
  if (platform === "win32") {
    const startMenuPrograms = win32.join("Microsoft", "Windows", "Start Menu", "Programs");
    const programData = env.ProgramData ?? env.PROGRAMDATA;
    const appData = env.APPDATA;
    const roots: string[] = [];
    if (programData) roots.push(win32.join(programData, startMenuPrograms));
    if (appData) roots.push(win32.join(appData, startMenuPrograms));
    return roots;
  }
  return [];
}

export function extensionsForPlatform(platform: string = process.platform, extra = false): readonly string[] {
  if (platform === "darwin") return [".app"];
  if (platform === "win32") return extra ? [".lnk", ".url", ".exe"] : [".lnk", ".url"];
  return [];
}

export function expandHome(dir: string, home: string = homedir()): string {
  const trimmed = dir.trim();
  if (trimmed === "~") return home;
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return join(home, trimmed.slice(2));
  return trimmed;
}

function folderLabel(fullPath: string, rootDir: string): string {
  const prefix = /[\\/]$/.test(rootDir) ? rootDir : `${rootDir}${sep}`;
  if (!fullPath.startsWith(prefix)) return "";
  const parent = dirname(fullPath);
  if (parent.length <= rootDir.length) return "";
  return parent
    .slice(prefix.length)
    .split(/[\\/]+/)
    .filter(Boolean)
    .join(" / ");
}

function matchExtension(entryName: string, extensions: readonly string[]): string | null {
  const lower = entryName.toLowerCase();
  for (const ext of extensions) {
    if (lower.endsWith(ext) && entryName.length > ext.length) {
      return ext;
    }
  }
  return null;
}

function walkDirectory(
  currentDir: string,
  rootDir: string,
  extensions: readonly string[],
  bundleIsDirectory: boolean,
  depth: number,
  collected: AppEntry[],
): void {
  let entries;
  try {
    entries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(currentDir, entry.name);
    const matchedExt = matchExtension(entry.name, extensions);
    if (matchedExt) {
      const validKind = bundleIsDirectory
        ? entry.isDirectory() || entry.isSymbolicLink()
        : entry.isFile() || entry.isSymbolicLink();
      if (validKind) {
        const displayName = entry.name.slice(0, -matchedExt.length).trim();
        if (displayName && !NOISE_NAME.test(displayName)) {
          collected.push({
            id: fullPath,
            name: displayName,
            path: fullPath,
            folder: folderLabel(fullPath, rootDir),
          });
        }
      }
      continue;
    }
    if (entry.isDirectory() && depth < MAX_WALK_DEPTH) {
      walkDirectory(fullPath, rootDir, extensions, bundleIsDirectory, depth + 1, collected);
    }
  }
}

export function scanApplications(
  roots: readonly string[] = defaultAppRoots(),
  platform: string = process.platform,
  extraRoots: readonly string[] = [],
): AppEntry[] {
  const bundleIsDirectory = platform === "darwin";
  const rawFound: AppEntry[] = [];
  const sources: Array<[readonly string[], readonly string[]]> = [
    [roots, extensionsForPlatform(platform)],
    [extraRoots, extensionsForPlatform(platform, true)],
  ];
  for (const [list, extensions] of sources) {
    if (extensions.length === 0) continue;
    for (const rootDir of list) {
      if (!rootDir) continue;
      walkDirectory(rootDir, rootDir, extensions, bundleIsDirectory, 1, rawFound);
    }
  }

  const seenPaths = new Set<string>();
  const byKey = new Map<string, AppEntry>();
  for (const item of rawFound) {
    if (seenPaths.has(item.path)) continue;
    seenPaths.add(item.path);
    const key = `${item.name.toLowerCase()}\u0000${item.folder.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, item);
  }

  return [...byKey.values()]
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
        a.folder.localeCompare(b.folder, undefined, { sensitivity: "base" }) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, MAX_SCANNED_APPS);
}

export function buildLaunchSpec(targetPath: string, platform: string = process.platform): LaunchSpec | null {
  if (!targetPath) return null;
  if (platform === "darwin") {
    return {
      command: "open",
      args: ["-a", targetPath],
      options: { detached: true, stdio: "ignore" },
    };
  }
  if (platform === "win32") {
    return {
      command: "explorer.exe",
      args: [targetPath],
      options: { detached: true, stdio: "ignore", windowsHide: true },
    };
  }
  return null;
}

export function launchApplication(targetPath: string, platform: string = process.platform): void {
  if (platform === "darwin") {
    const child = spawn("open", ["-a", targetPath], { detached: true, stdio: "ignore" });
    child.on("error", () => undefined);
    child.unref();
    return;
  }
  if (platform === "win32") {
    const child = spawn("explorer.exe", [targetPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => undefined);
    child.unref();
    return;
  }
  throw new Error(`Unsupported platform: ${platform}`);
}
