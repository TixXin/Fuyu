import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_DIR, SOURCE_EXTENSIONS } from "../entries.mjs";

const QUOTES = new Set(['"', "'", "`"]);
const OPEN = new Set(["{", "[", "("]);
const CLOSE = new Set(["}", "]", ")"]);
const NAME = "[A-Za-z_$][\\w$]*";

export function readSources(dir) {
  const walk = (folder) => {
    let entries;
    try {
      entries = readdirSync(folder, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.flatMap((entry) => {
      if (entry.name === "node_modules") return [];
      const path = join(folder, entry.name);
      if (entry.isDirectory()) return walk(path);
      return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ? [readFileSync(path, "utf8")] : [];
    });
  };
  return walk(join(dir, SOURCE_DIR));
}

function skip(text, at) {
  const char = text[at];
  if (QUOTES.has(char)) {
    let index = at + 1;
    while (index < text.length && text[index] !== char) index += text[index] === "\\" ? 2 : 1;
    return index + 1;
  }
  if (char === "/" && text[at + 1] === "/") {
    const end = text.indexOf("\n", at);
    return end < 0 ? text.length : end + 1;
  }
  if (char === "/" && text[at + 1] === "*") {
    const end = text.indexOf("*/", at + 2);
    return end < 0 ? text.length : end + 2;
  }
  return at;
}

function expressionEnd(text, start, whole = false) {
  let depth = 0;
  let index = start;
  while (index < text.length) {
    const next = skip(text, index);
    if (next !== index) {
      index = next;
      continue;
    }
    const char = text[index];
    if (OPEN.has(char)) depth += 1;
    else if (CLOSE.has(char)) {
      if (depth === 0) return index;
      depth -= 1;
    } else if (!whole && depth === 0 && (char === "," || char === ";")) return index;
    index += 1;
  }
  return index;
}

function properties(literal) {
  const found = new Map();
  let index = 1;
  while (index < literal.length - 1) {
    const end = expressionEnd(literal, index);
    const entry = literal.slice(index, end);
    const match = new RegExp(`^\\s*(?:(["'])(.*?)\\1|(${NAME}))\\s*:`).exec(entry);
    if (match) found.set(match[2] ?? match[3], entry.slice(match[0].length).trim());
    index = end + 1;
  }
  return found;
}

function clean(expression) {
  const source = expression.trim();
  let depth = 0;
  let index = 0;
  while (index < source.length) {
    const next = skip(source, index);
    if (next !== index) {
      index = next;
      continue;
    }
    const char = source[index];
    if (OPEN.has(char)) depth += 1;
    else if (CLOSE.has(char)) depth -= 1;
    else if (depth === 0 && /^\s(?:as|satisfies)\s/.test(source.slice(index, index + 11))) return source.slice(0, index).trim();
    index += 1;
  }
  return source;
}

function constant(sources, name) {
  const pattern = new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, "\\$")}\\s*(?::[^=;]+)?=\\s*`);
  for (const source of sources) {
    const match = pattern.exec(source);
    if (match) return source.slice(match.index + match[0].length, expressionEnd(source, match.index + match[0].length));
  }
  return null;
}

function literal(expression) {
  const match = /^(["'])((?:\\.|(?!\1).)*)\1$/s.exec(expression);
  return match ? match[2].replace(/\\(["'\\])/g, "$1") : null;
}

function text(sources, raw, depth = 0) {
  if (depth > 6 || typeof raw !== "string") return null;
  const expression = clean(raw);
  const plain = literal(expression);
  if (plain !== null) return plain;
  const member = new RegExp(`^(${NAME})(?:\\.(${NAME})|\\[(["'])(.*?)\\3\\])$`).exec(expression);
  if (member) {
    const target = constant(sources, member[1]);
    if (!target || !clean(target).startsWith("{")) return null;
    return text(sources, properties(clean(target)).get(member[2] ?? member[4]), depth + 1);
  }
  if (new RegExp(`^${NAME}$`).test(expression)) return text(sources, constant(sources, expression), depth + 1);
  return null;
}

function localized(sources, raw, depth = 0) {
  if (depth > 6 || typeof raw !== "string") return null;
  const expression = clean(raw);
  if (expression.startsWith("{")) {
    const props = properties(expression);
    return { "zh-CN": text(sources, props.get("zh-CN")), en: text(sources, props.get("en")) };
  }
  if (new RegExp(`^${NAME}$`).test(expression)) {
    const target = constant(sources, expression);
    if (target && clean(target).startsWith("{")) return localized(sources, target, depth + 1);
  }
  const same = text(sources, expression, depth);
  return same === null ? null : { "zh-CN": same, en: same };
}

export function slotTitles(sources, slot) {
  const titles = [];
  const call = new RegExp(`slots\\.add\\(\\s*(["'])${slot.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\1\\s*,\\s*\\{`, "g");
  for (const source of sources) {
    for (const match of source.matchAll(call)) {
      const open = match.index + match[0].length - 1;
      const close = expressionEnd(source, open + 1, true);
      const resolved = localized(sources, properties(source.slice(open, close + 1)).get("title"));
      if (resolved) titles.push(resolved);
    }
  }
  return titles;
}
