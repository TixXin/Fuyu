import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { findEverythingExe, searchEverything } from "./everything.ts";
import { islandApi } from "./island-api.ts";
import {
  METHODS,
  TOPICS,
  backendFor,
  emptyResult,
  normalizeQuery,
  normalizeSettings,
  openSpec,
  type FileHit,
  type FileSearchSettings,
  type FileSearchState,
  type SearchResult,
} from "./model.ts";
import { scanRecentFiles } from "./recent.ts";
import { searchSpotlight } from "./spotlight.ts";

export const name = "@fuyu/file-search";
export const inject = { clients: null, commands: null, island: { required: false }, settings: { required: false } };

const PAGE_ID = "@fuyu/file-search";
const CONFIG_FILE = "config.json";
const SEARCH_TIMEOUT_MS = 4000;
const REMEMBERED_PATHS = 500;
const START_WAIT_MS = 1500;
const RECENT_LIMIT = 8;
const DOWNLOAD_PAGE = "https://www.voidtools.com/downloads/";
const COMMAND_TITLE = { "zh-CN": "打开文件搜索", en: "Open File search" };
const DEFAULT_KEYBINDING = "Ctrl+Alt+F";

function detached(command: string, args: string[]): void {
  if (process.env.FUYU_FILE_SEARCH_DRY_RUN === "1") return;
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => undefined);
  child.unref();
}

function readSettings(file: string): FileSearchSettings {
  try {
    return existsSync(file) ? normalizeSettings(JSON.parse(readFileSync(file, "utf8"))) : normalizeSettings(null);
  } catch {
    return normalizeSettings(null);
  }
}

function saveSettings(dir: string, settings: FileSearchSettings): void {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  } catch {
    return;
  }
}

export function apply(ctx: Context) {
  const platform = process.platform;
  const backend = backendFor(platform);
  const home = homedir();
  const known = new Map<string, FileHit>();
  const openedRecent: FileHit[] = [];
  let settings = readSettings(join(ctx.dataDir, CONFIG_FILE));
  let lastQuery = "";

  const schedule = (callback: () => void, ms: number) => {
    const dispose = ctx.setTimeout(callback, ms);
    return () => {
      dispose();
    };
  };

  function rememberHits(hits: readonly FileHit[]): void {
    for (const hit of hits) {
      known.delete(hit.path);
      known.set(hit.path, hit);
    }
    while (known.size > REMEMBERED_PATHS) {
      const oldest = known.keys().next().value;
      if (oldest === undefined) break;
      known.delete(oldest);
    }
  }

  function loadRecent(): FileHit[] {
    if (!settings.showRecent) return [];
    const scanned = scanRecentFiles(platform, home, RECENT_LIMIT);
    const merged: FileHit[] = [];
    const seen = new Set<string>();
    for (const hit of [...openedRecent, ...scanned]) {
      if (seen.has(hit.path)) continue;
      seen.add(hit.path);
      merged.push(hit);
      if (merged.length >= RECENT_LIMIT) break;
    }
    rememberHits(merged);
    return merged;
  }

  const snapshot = (): FileSearchState => ({
    settings,
    backend,
    recent: loadRecent(),
    lastQuery: settings.rememberQuery ? lastQuery : "",
    homeDir: home,
    at: Date.now(),
  });

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());

  ctx.clients.handle(METHODS.getState, async () => snapshot());

  ctx.clients.handle(METHODS.recent, async () => loadRecent());

  ctx.clients.handle(METHODS.setSettings, async (params?: unknown) => {
    settings = normalizeSettings(params, settings);
    if (!settings.rememberQuery) lastQuery = "";
    saveSettings(ctx.dataDir, settings);
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.search, async (params?: { query?: unknown }) => {
    const query = normalizeQuery(params?.query);
    if (settings.rememberQuery) lastQuery = query;
    let result: SearchResult;
    if (backend === "everything") {
      result = await searchEverything(query, { timeoutMs: SEARCH_TIMEOUT_MS, schedule }, undefined, settings.resultLimit);
    } else if (backend === "spotlight") {
      result = await searchSpotlight(
        query,
        { timeoutMs: SEARCH_TIMEOUT_MS, schedule },
        { limit: settings.resultLimit, scope: settings.macScope },
      );
    } else {
      result = emptyResult(query, "none", "unsupported");
    }
    rememberHits(result.hits);
    return result;
  });

  ctx.clients.handle(METHODS.lastQuery, async () => (settings.rememberQuery ? lastQuery : ""));

  const openKnown = (reveal: boolean) => async (params?: { path?: unknown }) => {
    const target = typeof params?.path === "string" ? params.path : "";
    const hit = target ? known.get(target) : undefined;
    if (!target || !hit) throw new Error("unknown-path");
    const spec = openSpec(target, platform, reveal);
    if (!spec) throw new Error("unsupported");
    detached(spec.command, spec.args);
    const idx = openedRecent.findIndex((item) => item.path === target);
    if (idx >= 0) openedRecent.splice(idx, 1);
    openedRecent.unshift(hit);
    if (openedRecent.length > RECENT_LIMIT) openedRecent.length = RECENT_LIMIT;
    return true;
  };

  ctx.clients.handle(METHODS.open, openKnown(false));
  ctx.clients.handle(METHODS.reveal, openKnown(true));

  ctx.clients.handle(METHODS.startEverything, async () => {
    if (backend !== "everything") return false;
    const exe = findEverythingExe();
    if (!exe) return false;
    detached(exe, ["-startup"]);
    await new Promise<void>((resolve) => schedule(resolve, START_WAIT_MS));
    return true;
  });

  ctx.clients.handle(METHODS.openDownload, async () => {
    const spec = openSpec(DOWNLOAD_PAGE, platform, false);
    if (!spec) return false;
    detached(spec.command, spec.args);
    return true;
  });

  const island = islandApi(ctx);
  if (island?.open) {
    const open = island.open.bind(island);
    ctx.commands.register("open", () => open(PAGE_ID), { title: COMMAND_TITLE, keybinding: DEFAULT_KEYBINDING });
  }
}
