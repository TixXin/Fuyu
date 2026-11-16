import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");

const COLOUR_ONLY = new Set([".shelf-item--recent"]);

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(full);
    return entry.name.endsWith(".css") ? [full] : [];
  });
}

function blocks(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  let preludeStart = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        out.push({ prelude: css.slice(preludeStart, start).trim(), body: css.slice(start + 1, i) });
        preludeStart = i + 1;
      }
    }
  }
  return out;
}

const moving = (body) => /(^|[;\s])animation(-name)?\s*:\s*(?!none\b)[^;]+/.test(body);

test("every animation stops or calms down when Windows asks for less motion", () => {
  const sheets = cssFiles(SRC).map((file) => {
    const all = blocks(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""));
    const own = all
      .filter((block) => /prefers-reduced-motion:\s*reduce/.test(block.prelude))
      .map((block) => block.body)
      .join("\n");
    return { file, all, own };
  });
  const reduced = sheets.map((sheet) => sheet.own).join("\n");
  const missing = [];
  for (const { file, all, own } of sheets) {
    if (/\s\*\s*[,{]/.test(own)) continue;
    for (const block of all) {
      if (block.prelude.startsWith("@") || !moving(block.body)) continue;
      for (const selector of block.prelude.split(",").map((part) => part.trim())) {
        const element = selector.split(/\s+/).pop();
        if (COLOUR_ONLY.has(selector) || reduced.includes(selector) || reduced.includes(element)) continue;
        missing.push(`${path.relative(SRC, file)}: ${selector}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

const reducedRules = (file) => {
  const css = readFileSync(path.join(SRC, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return blocks(css)
    .filter((block) => /prefers-reduced-motion:\s*reduce/.test(block.prelude))
    .flatMap((block) => blocks(block.body))
    .map((rule) => ({
      selectors: rule.prelude.split(",").map((part) => part.trim()),
      declarations: Object.fromEntries(rule.body.split(";").map((line) => line.split(":")).filter((pair) => pair.length >= 2).map(([name, ...value]) => [name.trim(), value.join(":").replace(/!important/, "").trim()])),
    }));
};
const list = (value) => value.split(",").map((part) => part.trim());

test("less motion keeps fades and colour changes but drops every move, resize and zoom", () => {
  const everything = reducedRules("styles/base.css").find((rule) => rule.selectors.includes("*"));
  assert.ok(everything, "base.css has a reduced-motion rule for every element");
  const { declarations } = everything;
  assert.equal(declarations["transition-duration"], undefined, "durations stay what each element asked for, so elements without a transition stay instant");
  assert.equal(declarations["transition-delay"], undefined);
  const kept = list(declarations["transition-property"] ?? "all");
  assert.ok(kept.includes("opacity"), "fades stay");
  for (const moving of ["all", "transform", "translate", "scale", "rotate", "top", "left", "width", "height", "margin", "inset"]) {
    assert.ok(!kept.includes(moving), `${moving} is not transitioned`);
  }
});

test("the island shell still opens and closes when Windows asks for less motion", () => {
  const shell = reducedRules("windows/island/IslandShell.css").find((rule) => rule.selectors.includes(".island"));
  assert.ok(shell, "IslandShell.css lets the shell transition through");
  const kept = list(shell.declarations["transition-property"] ?? "");
  for (const variable of ["--island-shell-width", "--island-shell-height", "--island-shell-top-corner", "--island-shell-bottom-corner"]) {
    assert.ok(kept.includes(variable), variable);
  }
});
