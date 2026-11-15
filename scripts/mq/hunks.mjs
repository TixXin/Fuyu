import { createHash } from "node:crypto";

const NEWLINE = 0x0a;
const HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const ID_LENGTH = 6;
const PREVIEW_LINES = 2;
const PREVIEW_WIDTH = 100;

export function splitLines(buffer) {
  const lines = [];
  let start = 0;
  while (start < buffer.length) {
    const at = buffer.indexOf(NEWLINE, start);
    const end = at < 0 ? buffer.length : at + 1;
    lines.push(buffer.subarray(start, end));
    start = end;
  }
  return lines;
}

export function parseRanges(diffText) {
  const ranges = [];
  for (const line of diffText.split("\n")) {
    const found = HEADER.exec(line);
    if (!found) continue;
    const count = (value) => (value === undefined ? 1 : Number(value));
    ranges.push({ oldStart: Number(found[1]), oldCount: count(found[2]), newStart: Number(found[3]), newCount: count(found[4]) });
  }
  return ranges;
}

function hashOf(removed, added) {
  const hash = createHash("sha1");
  for (const line of removed) hash.update("-").update(line).update("\0");
  for (const line of added) hash.update("+").update(line).update("\0");
  return hash.digest("hex");
}

export function buildHunks(baseLines, workLines, ranges) {
  const seen = new Map();
  return ranges.map((range) => {
    const at = range.oldCount ? range.oldStart - 1 : range.oldStart;
    const from = range.newCount ? range.newStart - 1 : range.newStart;
    const removed = baseLines.slice(at, at + range.oldCount);
    const added = workLines.slice(from, from + range.newCount);
    const hash = hashOf(removed, added);
    const short = hash.slice(0, ID_LENGTH);
    const nth = (seen.get(short) ?? 0) + 1;
    seen.set(short, nth);
    return { id: nth === 1 ? short : `${short}-${nth}`, hash, at, line: from + 1, removed, added };
  });
}

export function applyHunks(baseLines, chosen) {
  const out = [];
  let cursor = 0;
  for (const hunk of [...chosen].sort((a, b) => a.at - b.at)) {
    out.push(...baseLines.slice(cursor, hunk.at), ...hunk.added);
    cursor = hunk.at + hunk.removed.length;
  }
  out.push(...baseLines.slice(cursor));
  return Buffer.concat(out);
}

function textOf(line) {
  return line.toString("utf8").replace(/\r?\n$/, "");
}

export function matchingHunks(hunks, pattern) {
  const regex = new RegExp(pattern, "u");
  return hunks.filter((hunk) => [...hunk.removed, ...hunk.added].some((line) => regex.test(textOf(line))));
}

function tally(lines) {
  const counts = new Map();
  for (const line of lines) {
    const key = line.toString("latin1");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function beyond(wanted, present, sign) {
  const have = tally(present);
  const stray = [];
  for (const line of wanted) {
    const key = line.toString("latin1");
    const left = have.get(key) ?? 0;
    if (left > 0) have.set(key, left - 1);
    else stray.push(`${sign} ${textOf(line)}`);
  }
  return stray;
}

export function strayLines(resultHunks, workHunks) {
  const all = (hunks, side) => hunks.flatMap((hunk) => hunk[side]);
  return {
    removed: beyond(all(resultHunks, "removed"), all(workHunks, "removed"), "-"),
    added: beyond(all(resultHunks, "added"), all(workHunks, "added"), "+"),
  };
}

function clip(text) {
  return text.length > PREVIEW_WIDTH ? `${text.slice(0, PREVIEW_WIDTH - 1)}…` : text;
}

export function previewOf(hunk) {
  const marked = [...hunk.removed.map((line) => `- ${textOf(line)}`), ...hunk.added.map((line) => `+ ${textOf(line)}`)];
  const shown = marked.slice(0, PREVIEW_LINES).map(clip);
  if (marked.length > PREVIEW_LINES) shown.push(`… 共 ${marked.length} 行`);
  return shown;
}

export function describeHunk(hunk) {
  const size = [hunk.added.length ? `+${hunk.added.length}` : "", hunk.removed.length ? `-${hunk.removed.length}` : ""].filter(Boolean).join(" ");
  return [`  ${hunk.id}  第 ${hunk.line} 行  ${size}`, ...previewOf(hunk).map((line) => `      ${line}`)];
}
