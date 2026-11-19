#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
export const OUTPUT = join(HERE, "..", "src", "preview", "app-styles.json");
const TOKENS = "src/styles/tokens.css";
const SOURCES = [
  ["src/windows/settings/SettingsWindow.css", /^\.settings-stage(?:--light)?$/],
  ["src/windows/settings/PluginPage.css", /\.plugin-(?:btn|icon|badge|verified|callout)/],
  ["src/windows/settings/PluginDetailModal.css", /\.plugin-(?:dialog|tabs)/],
  ["src/windows/settings/PluginMarket.css", /\.market-(?:card|cover|detail|shots?|markdown|dialog|badge|mono)/],
  ["src/components/markdown/Markdown.css", /\.markdown/],
];
const ALSO_USED = "var(--font-ui)";
const NESTING = /^@(?:container|media|supports|layer)\b/;

const squash = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();

function blocks(css) {
  const found = [];
  let start = 0;
  let depth = 0;
  let open = -1;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '"' || char === "'") {
      index += 1;
      while (index < css.length && css[index] !== char) index += css[index] === "\\" ? 2 : 1;
    } else if (char === "{") {
      if (depth === 0) open = index;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        found.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, index).trim() });
        start = index + 1;
      }
    } else if (char === ";" && depth === 0) start = index + 1;
  }
  return found;
}

function pick(css, wanted) {
  const kept = [];
  for (const { prelude, body } of blocks(css)) {
    if (prelude.startsWith("@")) {
      if (!NESTING.test(prelude)) continue;
      const inner = pick(body, wanted);
      if (inner.length > 0) kept.push(`${prelude} { ${inner.join(" ")} }`);
    } else if (wanted.test(prelude)) kept.push(`${prelude} { ${body} }`);
  }
  return kept;
}

function declarations(body) {
  const found = new Map();
  for (const part of body.split(";")) {
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(part);
    if (match) found.set(match[1], match[2].trim());
  }
  return found;
}

function tokens(css, used) {
  const scopes = blocks(css).map(({ prelude, body }) => ({ prelude, values: declarations(body) }));
  const wanted = new Set();
  const visit = (text) => {
    for (const [, name] of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (wanted.has(name)) continue;
      wanted.add(name);
      for (const scope of scopes) if (scope.values.has(name)) visit(scope.values.get(name));
    }
  };
  visit(used);
  return scopes
    .map(({ prelude, values }) => ({ prelude, lines: [...values].filter(([name]) => wanted.has(name)).map(([name, value]) => `${name}: ${value};`) }))
    .filter((scope) => scope.lines.length > 0)
    .map((scope) => `${scope.prelude} { ${scope.lines.join(" ")} }`);
}

export function render(read = (path) => readFileSync(join(REPO, path), "utf8")) {
  const rules = SOURCES.flatMap(([path, wanted]) => pick(squash(read(path)), wanted));
  const css = [...tokens(squash(read(TOKENS)), `${ALSO_USED}\n${rules.join("\n")}`), ...rules].join("\n");
  return `${JSON.stringify({ sources: [TOKENS, ...SOURCES.map(([path]) => path)], css }, null, 2)}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(OUTPUT, render());
  console.log(`wrote ${OUTPUT}`);
}
