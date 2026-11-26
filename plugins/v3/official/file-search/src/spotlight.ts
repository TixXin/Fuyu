import { homedir } from "node:os";
import { RESULT_LIMIT, emptyResult, mdfindArgs, toHits, type SearchResult } from "./model.ts";
import { runLines, type RunOptions } from "./runLines.ts";

export async function searchSpotlight(query: string, run: Omit<RunOptions, "maxLines">): Promise<SearchResult> {
  const result = emptyResult(query, "spotlight");
  if (!query) return result;
  const outcome = await runLines("mdfind", mdfindArgs(query, homedir()), { ...run, maxLines: RESULT_LIMIT + 1 });
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
  result.hits = toHits(lines, "darwin", RESULT_LIMIT);
  result.truncated = outcome.truncated || lines.length > RESULT_LIMIT;
  return result;
}
