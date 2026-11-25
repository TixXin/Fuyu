import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compareVersions } from "./channel.mjs";

const JSX_NEXT_SINCE = /\bsince=(?:"next"|\{"next"\})/g;
const JSON_NEXT_SINCE = /("since"\s*:\s*)"next"/g;
const JSX_ANY_SINCE = /\bsince=(?:"([^"]+)"|\{"([^"]+)"\})/g;
const SEMVER = /^(\d+\.\d+\.\d+)(?:-beta\.\d+)?$/;

const INDEX_FILES = [
  "src/windows/settings/searchIndex.json",
  "src/windows/settings/whatsNewIndex.json",
];

export function stampSinceText(text, version) {
  let count = 0;
  const next = text.replace(JSX_NEXT_SINCE, () => {
    count += 1;
    return `since="${version}"`;
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

export function stampNextSince(rootDir, version) {
  const stampedFiles = [];
  let total = 0;
  const allVersions = [];

  for (const file of walkTsFiles(path.join(rootDir, "src"))) {
    const original = readFileSync(file, "utf8");
    const { text, count } = stampSinceText(original, version);
    if (count > 0) {
      writeFileSync(file, text);
      stampedFiles.push(path.relative(rootDir, file).replaceAll("\\", "/"));
      total += count;
    }
    for (const match of text.matchAll(JSX_ANY_SINCE)) {
      allVersions.push(match[1] ?? match[2]);
    }
  }

  for (const rel of INDEX_FILES) {
    const full = path.join(rootDir, rel);
    if (!existsSync(full)) continue;
    const original = readFileSync(full, "utf8");
    const { text, count } = stampSinceJson(original, version);
    if (count > 0) {
      writeFileSync(full, text);
      stampedFiles.push(rel);
    }
  }

  return {
    files: stampedFiles,
    count: total,
    expired: expiredSinceVersions(allVersions, version),
  };
}
