import { spawn } from "node:child_process";
import type { Context } from "@fuyu/plugin-base";
import { findEverythingExe, searchEverything } from "./everything.ts";
import { islandApi } from "./island-api.ts";
import { METHODS, backendFor, emptyResult, normalizeQuery, openSpec, type SearchResult } from "./model.ts";
import { searchSpotlight } from "./spotlight.ts";

export const name = "@fuyu/file-search";
export const inject = { clients: null, commands: null, island: { required: false } };

const PAGE_ID = "@fuyu/file-search";
const SEARCH_TIMEOUT_MS = 4000;
const REMEMBERED_PATHS = 500;
const START_WAIT_MS = 1500;
const DOWNLOAD_PAGE = "https://www.voidtools.com/downloads/";
const COMMAND_TITLE = { "zh-CN": "打开文件搜索", en: "Open File search" };
const DEFAULT_KEYBINDING = "Ctrl+Alt+F";

function detached(command: string, args: string[]): void {
  if (process.env.FUYU_FILE_SEARCH_DRY_RUN === "1") return;
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => undefined);
  child.unref();
}

export function apply(ctx: Context) {
  const platform = process.platform;
  const backend = backendFor(platform);
  const known = new Set<string>();
  let lastQuery = "";

  const schedule = (callback: () => void, ms: number) => {
    const dispose = ctx.setTimeout(callback, ms);
    return () => {
      dispose();
    };
  };

  function remember(result: SearchResult): void {
    for (const hit of result.hits) {
      known.delete(hit.path);
      known.add(hit.path);
    }
    while (known.size > REMEMBERED_PATHS) {
      const oldest = known.values().next().value;
      if (oldest === undefined) break;
      known.delete(oldest);
    }
  }

  ctx.clients.handle(METHODS.search, async (params?: { query?: unknown }) => {
    const query = normalizeQuery(params?.query);
    lastQuery = query;
    let result: SearchResult;
    if (backend === "everything") result = await searchEverything(query, { timeoutMs: SEARCH_TIMEOUT_MS, schedule });
    else if (backend === "spotlight") result = await searchSpotlight(query, { timeoutMs: SEARCH_TIMEOUT_MS, schedule });
    else result = emptyResult(query, "none", "unsupported");
    remember(result);
    return result;
  });

  ctx.clients.handle(METHODS.lastQuery, async () => lastQuery);

  const openKnown = (reveal: boolean) => async (params?: { path?: unknown }) => {
    const target = typeof params?.path === "string" ? params.path : "";
    if (!target || !known.has(target)) throw new Error("unknown-path");
    const spec = openSpec(target, platform, reveal);
    if (!spec) throw new Error("unsupported");
    detached(spec.command, spec.args);
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
