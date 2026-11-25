import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compareVersions } from "./channel.mjs";

const JSX_NEXT_SINCE = /\bsince=(?:"next"|\{"next"\})/g;
const JSON_NEXT_SINCE = /("since"\s*:\s*)"next"/g;
const JSX_ANY_SINCE = /\bsince=(?:"([^"]+)"|\{"([^"]+)"\})/g;
const SEMVER = /^(\d+\.\d+\.\d+)(?:-beta\.\d+)?$/;

const SEARCH_INDEX_FILE = "src/windows/settings/searchIndex.json";
const WHATS_NEW_INDEX_FILE = "src/windows/settings/whatsNewIndex.json";

export function stampSinceText(text, version) {
  let count = 0;
  const next = text.replace(JSX_NEXT_SINCE, () => {
    count += 1;
    return `since="${version}"`;
  });
  return { text: next, count };
}

export function pruneSinceText(text, expiredSet) {
  if (!expiredSet || expiredSet.size === 0) return { text, count: 0 };
  let count = 0;
  const next = text.replace(/\s*\bsince=(?:"([^"]+)"|\{"([^"]+)"\})/g, (match, doubleQuoted, braced) => {
    const version = doubleQuoted ?? braced;
    if (!expiredSet.has(version)) return match;
    count += 1;
    return "";
  });
  return { text: next, count };
}

export function stampSinceJson(text, version) {
  let count = 0;
  const next = text.replace(JSON_NEXT_SINCE, (_, prefix) => {
    count += 1;
    return `${prefix}"${version}"`;
  });
  return { text: next, count };
}

export function expiredSinceVersions(versions, currentVersion, keepBases = 3) {
  const valid = [...new Set(versions)].filter((version) => SEMVER.test(version) && compareVersions(version, currentVersion) <= 0);
  valid.sort((a, b) => compareVersions(b, a));
  const keptBases = new Set();
  for (const version of valid) {
    const base = version.match(SEMVER)[1];
    if (keptBases.size < keepBases) keptBases.add(base);
  }
  return valid.filter((version) => !keptBases.has(version.match(SEMVER)[1])).reverse();
}

function walkTsFiles(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, found);
    else if (/\.(tsx?|mts)$/.test(entry.name)) found.push(full);
  }
  return found;
}

function readIndex(fullPath) {
  if (!existsSync(fullPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(fullPath, "utf8"));
    return parsed && Array.isArray(parsed.entries) ? parsed : null;
  } catch {
    return null;
  }
}

export function stampNextSince(rootDir, version, keepBases = 3) {
  const stampedFiles = new Set();
  let stampedCount = 0;
  let prunedCount = 0;
  const allVersions = [];

  const tsFiles = walkTsFiles(path.join(rootDir, "src"));
  const tsContents = new Map();
  for (const file of tsFiles) {
    const original = readFileSync(file, "utf8");
    const { text, count } = stampSinceText(original, version);
    if (count > 0) {
      stampedCount += count;
      stampedFiles.add(path.relative(rootDir, file).replaceAll("\\", "/"));
    }
    tsContents.set(file, { original, text });
    for (const match of text.matchAll(JSX_ANY_SINCE)) {
      const value = match[1] ?? match[2];
      if (SEMVER.test(value)) allVersions.push(value);
    }
  }

  const searchPath = path.join(rootDir, SEARCH_INDEX_FILE);
  const whatsNewPath = path.join(rootDir, WHATS_NEW_INDEX_FILE);
  const searchDoc = readIndex(searchPath);
  const whatsNewDoc = readIndex(whatsNewPath);

  let indexStamped = 0;
  if (searchDoc) {
    for (const entry of searchDoc.entries) {
      if (entry.since === "next") {
        entry.since = version;
        indexStamped += 1;
      }
      if (typeof entry.since === "string" && SEMVER.test(entry.since)) allVersions.push(entry.since);
    }
  }
  if (whatsNewDoc) {
    for (const entry of whatsNewDoc.entries) {
      if (entry.since === "next") {
        entry.since = version;
        if (!searchDoc) indexStamped += 1;
      }
      if (typeof entry.since === "string" && SEMVER.test(entry.since)) allVersions.push(entry.since);
    }
  }
  const totalCount = Math.max(stampedCount, indexStamped);
  const expired = expiredSinceVersions(allVersions, version, keepBases);
  const expiredSet = new Set(expired);

  for (const [file, { original, text }] of tsContents) {
    const { text: finalText, count: removed } = pruneSinceText(text, expiredSet);
    if (removed > 0) prunedCount += removed;
    if (finalText !== original) {
      writeFileSync(file, finalText);
      stampedFiles.add(path.relative(rootDir, file).replaceAll("\\", "/"));
    }
  }

  if (searchDoc) {
    const before = readFileSync(searchPath, "utf8");
    const nextEntries = searchDoc.entries.map((entry) => {
      if (typeof entry.since === "string" && expiredSet.has(entry.since)) {
        prunedCount += 1;
        const { since: _, ...rest } = entry;
        return rest;
      }
      return entry;
    });
    const after = `${JSON.stringify({ ...searchDoc, entries: nextEntries }, null, 2)}\n`;
    if (after !== before) {
      writeFileSync(searchPath, after);
      stampedFiles.add(SEARCH_INDEX_FILE);
    }
  }

  if (whatsNewDoc) {
    const before = readFileSync(whatsNewPath, "utf8");
    const nextEntries = whatsNewDoc.entries.filter((entry) => !(typeof entry.since === "string" && expiredSet.has(entry.since)));
    if (!searchDoc) prunedCount += whatsNewDoc.entries.length - nextEntries.length;
    const after = `${JSON.stringify({ ...whatsNewDoc, entries: nextEntries }, null, 2)}\n`;
    if (after !== before) {
      writeFileSync(whatsNewPath, after);
      stampedFiles.add(WHATS_NEW_INDEX_FILE);
    }
  }

  return {
    files: [...stampedFiles],
    count: totalCount,
    prunedCount,
    expired,
  };
}
