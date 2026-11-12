import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const IGNORE_FILE = ".fuyuignore";
export const LEGACY_IGNORE_FILE = ".focusdignore";
const ALWAYS_IGNORED = [".git/", "/.package/", IGNORE_FILE, LEGACY_IGNORE_FILE];

function patternToRegExp(pattern) {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") {
      const slash = pattern[index + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      index += slash ? 2 : 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return source;
}

export function parseIgnore(text) {
  return [...ALWAYS_IGNORED, ...text.split(/\r?\n/)]
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const negate = line.startsWith("!");
      let pattern = negate ? line.slice(1) : line;
      const dirOnly = pattern.endsWith("/");
      if (dirOnly) pattern = pattern.slice(0, -1);
      const anchored = pattern.includes("/");
      if (pattern.startsWith("/")) pattern = pattern.slice(1);
      const prefix = anchored ? "^" : "^(?:.*/)?";
      return { negate, dirOnly, regexp: new RegExp(`${prefix}${patternToRegExp(pattern)}$`) };
    });
}

export function isIgnored(rules, relativePath) {
  const parts = relativePath.split("/");
  let ignored = false;
  for (const rule of rules) {
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const candidate = parts.slice(0, depth).join("/");
      const isDir = depth < parts.length;
      if (rule.dirOnly && !isDir) continue;
      if (rule.regexp.test(candidate)) {
        ignored = !rule.negate;
        break;
      }
    }
  }
  return ignored;
}

export function ignoreFileOf(dir) {
  return [IGNORE_FILE, LEGACY_IGNORE_FILE].find((name) => existsSync(path.join(dir, name))) ?? null;
}

export function loadIgnore(dir) {
  const file = ignoreFileOf(dir);
  return parseIgnore(file ? readFileSync(path.join(dir, file), "utf8") : "");
}
