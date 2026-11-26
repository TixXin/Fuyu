import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { RESULT_LIMIT, emptyResult, esArgs, esTerms, toHits, type SearchResult } from "./model.ts";
import { runLines, type RunOptions, type RunOutcome } from "./runLines.ts";

const EVERYTHING_DIRS = ["Everything", "Everything 1.5a", "Everything 1.5"];
const EVERYTHING_EXES = ["Everything.exe", "Everything64.exe"];
const ES_NOT_RUNNING = 8;

export interface EverythingEnv {
  env: Record<string, string | undefined>;
  exists: (path: string) => boolean;
}

const defaultEnv: EverythingEnv = { env: process.env, exists: existsSync };

function programRoots(env: Record<string, string | undefined>): string[] {
  const roots = [env.ProgramFiles, env["ProgramFiles(x86)"], env.ProgramW6432];
  if (env.LOCALAPPDATA) roots.push(join(env.LOCALAPPDATA, "Programs"));
  return [...new Set(roots.filter((root): root is string => typeof root === "string" && root.length > 0))];
}

export function findEverythingExe(host: EverythingEnv = defaultEnv): string | null {
  for (const root of programRoots(host.env)) {
    for (const dir of EVERYTHING_DIRS) {
      for (const exe of EVERYTHING_EXES) {
        const candidate = join(root, dir, exe);
        if (host.exists(candidate)) return candidate;
      }
    }
  }
  return null;
}

export function esCandidates(everythingExe: string | null, host: EverythingEnv = defaultEnv): string[] {
  const found: string[] = [];
  if (everythingExe) found.push(join(dirname(everythingExe), "es.exe"));
  if (host.env.LOCALAPPDATA) found.push(join(host.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "es.exe"));
  const existing = found.filter((path) => host.exists(path));
  return [...existing, "es.exe"];
}

export function classifyEs(query: string, outcome: RunOutcome, everythingExe: string | null): SearchResult {
  const result = emptyResult(query, "everything");
  result.canStart = everythingExe !== null;
  if (outcome.missing) {
    result.status = everythingExe ? "no-es" : "no-everything";
    return result;
  }
  if (outcome.code === ES_NOT_RUNNING) {
    result.status = "not-running";
    return result;
  }
  if (outcome.timedOut && outcome.lines.length === 0) {
    result.status = "error";
    result.message = "timeout";
    return result;
  }
  if (outcome.code !== 0 && outcome.code !== null && !outcome.timedOut) {
    result.status = "error";
    result.message = outcome.stderr.trim() || `es.exe exit ${outcome.code}`;
    return result;
  }
  result.hits = toHits(outcome.lines, "win32", RESULT_LIMIT);
  result.truncated = outcome.truncated || outcome.lines.filter((line) => line.trim()).length > RESULT_LIMIT;
  return result;
}

export async function searchEverything(
  query: string,
  run: Omit<RunOptions, "maxLines">,
  host: EverythingEnv = defaultEnv,
): Promise<SearchResult> {
  if (esTerms(query).length === 0) return emptyResult(query, "everything");
  const everythingExe = findEverythingExe(host);
  let last: RunOutcome | null = null;
  for (const es of esCandidates(everythingExe, host)) {
    last = await runLines(es, esArgs(query), { ...run, maxLines: RESULT_LIMIT + 1 });
    if (!last.missing) break;
  }
  return classifyEs(query, last ?? { lines: [], code: null, missing: true, timedOut: false, truncated: false, stderr: "" }, everythingExe);
}
