import { homedir } from "node:os";
import { RESULT_LIMIT, emptyResult, mdfindArgs, toHits, type MacScope, type SearchResult } from "./model.ts";
import { commonFolders } from "./recent.ts";
import { runLines, type RunOptions } from "./runLines.ts";

function scopeDirs(scope: MacScope, home: string): string | string[] | null {
  if (scope === "all") return null;
  if (scope === "common") {
    const dirs = commonFolders(home);
    return dirs.length > 0 ? dirs : home;
  }
  return home;
}

export async function searchSpotlight(
  query: string,
  run: Omit<RunOptions, "maxLines">,
  options: { limit?: number; scope?: MacScope } = {},
): Promise<SearchResult> {
  const limit = options.limit ?? RESULT_LIMIT;
  const result = emptyResult(query, "spotlight");
  if (!query) return result;
  const dirs = scopeDirs(options.scope ?? "home", homedir());
  const outcome = await runLines("mdfind", mdfindArgs(query, dirs), { ...run, maxLines: limit + 1 });
  if (outcome.missing) {
    result.status = "unsupported";
    return result;
  }
  if (outcome.timedOut && outcome.lines.length === 0) {
    result.status = "error";
    result.message = "timeout";
    return result;
  }
  if (outcome.code !== 0 && outcome.code !== null && !outcome.timedOut) {
    result.status = "error";
    result.message = outcome.stderr.trim() || `mdfind exit ${outcome.code}`;
    return result;
  }
  const lines = outcome.lines.filter((line) => line.trim());
  result.hits = toHits(lines, "darwin", limit);
  result.truncated = outcome.truncated || lines.length > limit;
  return result;
}
