import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { mappedOffsets } from "./sourceMap.mjs";

export const COVERAGE_FILE = "fuyu-regression-coverage.json";
export const COVERAGE_VERSION = 1;
export const WHOLE_FILE = "*";
const SOURCE_DIRS = /^(src|tests|packages|vendor)\//;

export function coverageFile(root) {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" }).trim();
  return path.join(path.resolve(root, common), COVERAGE_FILE);
}

export function repoPath(url, root) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const outside = pathname.startsWith("/@fs/") ? pathname.slice(4).replace(/^\/([A-Za-z]:)/, "$1") : null;
  const file = outside ? path.relative(root, outside).split(path.sep).join("/") : pathname.slice(1);
  if (!SOURCE_DIRS.test(file) || file.includes("/node_modules/") || file.startsWith("..")) return null;
  return file;
}

export function servedUrl(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("t");
  return parsed.href;
}

export function flattenRanges(functions) {
  const ranges = functions.flatMap((fn) => fn.ranges).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const out = [];
  const stack = [];
  let at = 0;
  const emit = (range, from, to) => {
    if (to > from) out.push([from, to, range.count]);
  };
  for (const range of ranges) {
    while (stack.length && stack[stack.length - 1].endOffset <= range.startOffset) {
      const done = stack.pop();
      emit(done, at, done.endOffset);
      at = Math.max(at, done.endOffset);
    }
    if (stack.length) emit(stack[stack.length - 1], at, range.startOffset);
    at = Math.max(at, range.startOffset);
    stack.push(range);
  }
  while (stack.length) {
    const done = stack.pop();
    emit(done, at, done.endOffset);
    at = Math.max(at, done.endOffset);
  }
  return out;
}

const offsetCache = new WeakMap();

function offsetsOf(served) {
  if (!offsetCache.has(served)) offsetCache.set(served, mappedOffsets(served.code, served.map));
  return offsetCache.get(served);
}

export function executedLines(offsets, functions) {
  const spans = flattenRanges(functions).filter(([, , count]) => count > 0);
  const lines = new Set();
  let index = 0;
  for (const [offset, line] of offsets) {
    while (index < spans.length && spans[index][1] <= offset) index += 1;
    if (index < spans.length && spans[index][0] <= offset) lines.add(line);
  }
  return lines;
}

export function formatRanges(lines) {
  const sorted = [...lines].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return parts.join(",");
}

export function parseRanges(text) {
  if (text === WHOLE_FILE) return WHOLE_FILE;
  const ranges = [];
  for (const part of text ? text.split(",") : []) {
    const [from, to = from] = part.split("-").map(Number);
    ranges.push([from, to]);
  }
  return ranges;
}

export function rangesHit(ranges, lines) {
  if (ranges === WHOLE_FILE) return true;
  return lines.some((line) => ranges.some(([from, to]) => line >= from && line <= to));
}

const ran = (script) => script.functions.some((fn) => fn.ranges.some((range) => range.count > 0));

export async function pageCoverage(scripts, { root, sourceFor }) {
  const files = {};
  const mapped = {};
  for (const script of scripts) {
    const file = repoPath(script.url, root);
    if (!file || !ran(script)) continue;
    const served = await sourceFor(script.url).catch(() => null);
    const map = served?.map;
    if (!served?.code || !map?.mappings || !(map.sources?.length === 1)) {
      files[file] = WHOLE_FILE;
      continue;
    }
    if (files[file] === WHOLE_FILE) continue;
    const offsets = offsetsOf(served);
    mapped[file] ??= formatRanges(new Set(offsets.map(([, line]) => line)));
    const lines = executedLines(offsets, script.functions);
    const previous = files[file] ? parseRanges(files[file]) : [];
    for (const [from, to] of previous) for (let line = from; line <= to; line++) lines.add(line);
    if (lines.size) files[file] = formatRanges(lines);
  }
  return { files, mapped };
}

export const COVERAGE_PARAMS = { callCount: false, detailed: false };

export async function startCoverage(session) {
  await session.send("Profiler.enable");
  await session.send("Profiler.startPreciseCoverage", COVERAGE_PARAMS);
}

export async function takeCoverage(session) {
  const { result = [] } = await session.send("Profiler.takePreciseCoverage");
  await session.send("Profiler.stopPreciseCoverage");
  return result;
}

export function readTable(file) {
  if (!existsSync(file)) return null;
  try {
    const table = JSON.parse(readFileSync(file, "utf8"));
    return table?.version === COVERAGE_VERSION && table.pages ? table : null;
  } catch {
    return null;
  }
}

export function writeTable(file, table) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ version: COVERAGE_VERSION, ...table })}\n`);
  renameSync(temp, file);
}

export function filePages(table) {
  const byFile = new Map();
  for (const [page, files] of Object.entries(table.pages)) {
    for (const [file, ranges] of Object.entries(files)) {
      if (!byFile.has(file)) byFile.set(file, new Map());
      byFile.get(file).set(page, parseRanges(ranges));
    }
  }
  return byFile;
}

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const TRACKED = ["src", "tests", "packages", "vendor", "index.html", ":(exclude)tests/regression/snapshots"];

export function wantsCoverage({ words, shard, env = process.env }) {
  if (env.REGRESSION_COVERAGE === "0") return false;
  if (env.REGRESSION_COVERAGE === "1") return true;
  return words.length === 0 && !shard && env.CI !== "true";
}

const INLINE_MAP = /\n\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/;

export function inlineMap(code) {
  const match = INLINE_MAP.exec(code);
  if (!match) return null;
  try {
    return JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function fetchSource(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const code = await response.text();
  return { code, map: inlineMap(code) };
}

export function coverageRecorder({ root, load = fetchSource, head = () => git(root, ["rev-parse", "HEAD"]) }) {
  const startSha = head();
  const pages = {};
  const mapped = {};
  const sources = new Map();
  const sourceFor = (url) => {
    const key = servedUrl(url);
    if (!sources.has(key)) sources.set(key, load(url));
    return sources.get(key);
  };
  return {
    start: (session) => startCoverage(session),
    async finish(session, page, passed) {
      const scripts = await takeCoverage(session);
      if (!passed) return;
      const result = await pageCoverage(scripts, { root, sourceFor });
      pages[page] = result.files;
      Object.assign(mapped, result.mapped);
    },
    pages,
    mapped,
    write({ file = coverageFile(root), now = new Date(), dirty = git(root, ["status", "--porcelain", "--", ...TRACKED]), sha = head() } = {}) {
      const count = Object.keys(pages).length;
      if (!count) return "Coverage: no passed page, table not written.";
      if (sha !== startSha) return `Coverage: not written, HEAD moved from ${startSha.slice(0, 9)} to ${sha.slice(0, 9)} during the run.`;
      if (dirty) return `Coverage: not written, ${dirty.split("\n").length} uncommitted source file(s) would shift its line numbers.`;
      writeTable(file, { sha: startSha, at: now.toISOString(), pages, mapped });
      return `Coverage: ${count} pages written to ${file}.`;
    },
  };
}
