import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { coverageFile, filePages, parseRanges, rangesHit, readTable, WHOLE_FILE } from "./coverage.mjs";
import { snapshotFile } from "./snapshots.mjs";

export const MAX_AGE_DAYS = 14;
const CODE = /\.(tsx?|jsx?|mjs|json|css)$/;
const SOURCE = /^(src|tests|packages|vendor)\//;
const TEXT_DIRS = ["src/i18n/sections/", "src/i18n/locales/"];
const KEY = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\??\s*:/;

export function usableTable(table, { now = Date.now(), hasCommit = () => true } = {}) {
  if (!table?.sha || !table.at || !table.pages) return { table: null, why: "还没有覆盖率表" };
  const days = (now - Date.parse(table.at)) / 86_400_000;
  if (!(days <= MAX_AGE_DAYS)) return { table: null, why: `覆盖率表是 ${Math.floor(days)} 天前的` };
  if (!hasCommit(table.sha)) return { table: null, why: `覆盖率表的提交 ${table.sha.slice(0, 9)} 不在本地` };
  return { table, why: null };
}

export function parseHunks(diff) {
  const hunks = [];
  let current = null;
  for (const line of diff.replace(/\r\n/g, "\n").split("\n")) {
    const head = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(line);
    if (head) {
      current = { start: Number(head[1]), count: head[2] === undefined ? 1 : Number(head[2]), removed: [], added: [] };
      hunks.push(current);
    } else if (current && line.startsWith("-") && !line.startsWith("---")) {
      current.removed.push(line.slice(1));
    } else if (current && line.startsWith("+") && !line.startsWith("+++")) {
      current.added.push(line.slice(1));
    }
  }
  return hunks;
}

function nearestMapped(mapped, line, step) {
  if (mapped === WHOLE_FILE) return line;
  let best = null;
  for (const [from, to] of mapped) {
    if (step < 0 && from <= line) best = Math.max(best ?? -Infinity, Math.min(to, line));
    if (step > 0 && to >= line) best = Math.min(best ?? Infinity, Math.max(from, line));
  }
  return best;
}

export function hunkLines(hunk, mapped) {
  const old = Array.from({ length: hunk.count }, (_, index) => hunk.start + index);
  const hits = mapped === WHOLE_FILE ? old : old.filter((line) => rangesHit(mapped, [line]));
  if (hits.length) return hits;
  const before = hunk.count ? hunk.start - 1 : hunk.start;
  const after = before + hunk.count + 1;
  return [nearestMapped(mapped, before, -1), nearestMapped(mapped, after, 1)].filter((line) => line !== null && line > 0);
}

const LITERAL = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
const unescape = (text) => text.replace(/\\u\{?([0-9a-fA-F]+)\}?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1");

export function lineTexts(line) {
  const key = KEY.exec(line);
  if (!key) return null;
  const texts = [];
  for (const match of line.slice(key[0].length).matchAll(LITERAL)) {
    const parts = match[3] !== undefined ? match[3].split(/\$\{[^}]*\}/) : [match[1] ?? match[2]];
    for (const part of parts) {
      const text = unescape(part).trim();
      if ([...text.replace(/\s+/g, "")].length >= 2) texts.push(text);
    }
  }
  return texts;
}

const TYPE_LINE = /^\s*[\w$"']+\??\s*:\s*[^,;]*\b(string|number|boolean)\b/;

export function hunkTexts(hunk) {
  const texts = new Set();
  for (const line of [...hunk.removed, ...hunk.added]) {
    if (!line.trim()) continue;
    const found = lineTexts(line);
    if (!found) return null;
    if (!found.length && !TYPE_LINE.test(line)) return null;
    for (const text of found) texts.add(text);
  }
  return texts;
}

export function textWords(text) {
  return text.split(/[\s,，、;；。.!！?？:：()（）「」"'/]+/).filter((word) => [...word].length >= 2);
}

const wordIn = (source, word) => [`"${word}"`, `'${word}'`, `\`${word}\``].some((quoted) => source.includes(quoted));

export function pageShows({ snapshot, source }, texts) {
  return [...texts].some((text) => showsText(snapshot, text) || source.includes(text) || textWords(text).some((word) => word !== text && wordIn(source, word)));
}

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (text) => escapeHtml(text).replace(/"/g, "&quot;");

export function showsText(content, text) {
  return content.includes(text) || content.includes(escapeHtml(text)) || content.includes(escapeAttribute(text));
}

export const isTextFile = (file) => TEXT_DIRS.some((dir) => file.startsWith(dir));

const run = (root, args) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

export function gitReader(root) {
  return {
    hasCommit: (sha) => run(root, ["cat-file", "-e", `${sha}^{commit}`]).status === 0,
    existedAt: (sha, file) => run(root, ["cat-file", "-e", `${sha}:${file}`]).status === 0,
    diff: (sha, file) => run(root, ["diff", "-U0", "--no-color", "--no-ext-diff", sha, "--", file]).stdout ?? "",
  };
}

export function coveragePages({ changed, pages, table, git, exists, ownFiles, importPages, pageText }) {
  const byFile = filePages(table);
  const mapped = table.mapped ?? {};
  const known = pages.filter((page) => table.pages[page]);
  const unknown = pages.filter((page) => !table.pages[page]);
  const chosen = new Set(importPages(unknown, changed));
  const reasons = { coverage: 0, imports: 0, newPages: unknown.length };
  const pick = (page) => chosen.add(page);
  const hitPages = (file, lines) => {
    for (const [page, ranges] of byFile.get(file) ?? []) if (known.includes(page) && rangesHit(ranges, lines)) pick(page);
  };
  for (const file of changed) {
    for (const page of known) if (ownFiles(page).includes(file)) pick(page);
    if (!SOURCE.test(file)) continue;
    if (!git.existedAt(table.sha, file)) {
      reasons.imports += 1;
      for (const page of importPages(known, [file])) pick(page);
      continue;
    }
    if (!byFile.has(file)) {
      if (!CODE.test(file)) {
        reasons.imports += 1;
        for (const page of importPages(known, [file])) pick(page);
      }
      continue;
    }
    reasons.coverage += 1;
    if (!exists(file)) {
      for (const page of byFile.get(file).keys()) if (known.includes(page)) pick(page);
      continue;
    }
    const fileMapped = mapped[file] ? parseRanges(mapped[file]) : WHOLE_FILE;
    const texts = new Set();
    for (const hunk of parseHunks(git.diff(table.sha, file))) {
      const found = isTextFile(file) ? hunkTexts(hunk) : null;
      if (found) for (const text of found) texts.add(text);
      else hitPages(file, hunkLines(hunk, fileMapped));
    }
    if (texts.size) {
      for (const page of known) {
        if (!byFile.get(file)?.has(page) || chosen.has(page)) continue;
        if (pageShows(pageText(page), texts)) pick(page);
      }
    }
  }
  return { pages: pages.filter((page) => chosen.has(page)), reasons };
}

const readOr = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

export function selectByCoverage({ root, changed, pages, importPages, entryOf, now = Date.now(), file = coverageFile(root) }) {
  const git = gitReader(root);
  const { table, why } = usableTable(readTable(file), { now, hasCommit: git.hasCommit });
  if (!table) return { pages: null, note: `${why}，按 import 关系挑页（全量跑一遍回归页会生成，例如 pnpm mq:verify）` };
  const ownFiles = (page) => {
    const entry = entryOf(page);
    return [`tests/regression/${page.split("?")[0]}`, ...(entry ? [path.relative(root, entry).split(path.sep).join("/")] : [])];
  };
  const pageText = (page) => ({
    snapshot: [snapshotFile(root, page, "dark"), snapshotFile(root, page, "light")].map(readOr).join("\n"),
    source: ownFiles(page).map((own) => readOr(path.join(root, own))).join("\n"),
  });
  const exists = (changedFile) => existsSync(path.join(root, changedFile));
  const result = coveragePages({ changed, pages, table, git, exists, ownFiles, importPages, pageText });
  const days = Math.floor((now - Date.parse(table.at)) / 86_400_000);
  const fallback = [result.reasons.newPages && `${result.reasons.newPages} 页不在表里`, result.reasons.imports && `${result.reasons.imports} 个文件不在表里`].filter(Boolean);
  return { pages: result.pages, note: `按覆盖率表挑页（${table.sha.slice(0, 9)}，${days ? `${days} 天前` : "今天"}${fallback.length ? `；${fallback.join("、")}，这部分按 import 关系` : ""}）` };
}
