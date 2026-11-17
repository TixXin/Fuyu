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
const calmsAnimation = (body) => /(^|[;\s])(animation(-name|-duration|-play-state|-timing-function)?|visibility|display)\s*:/.test(body);

function parseRules(css, media = []) {
  const out = [];
  for (const block of blocks(css)) {
    if (block.prelude.startsWith("@keyframes")) continue;
    if (block.prelude.startsWith("@")) {
      out.push(...parseRules(block.body, [...media, block.prelude]));
    } else {
      const selectors = block.prelude.split(",").map((part) => part.trim()).filter(Boolean);
      out.push({ selectors, body: block.body, media });
    }
  }
  return out;
}

function selectorMatches(animated, reduced) {
  if (reduced === "*" || /\s\*\s*$/.test(reduced)) return true;
  if (animated === reduced) return true;
  if (animated.endsWith(` ${reduced}`) || animated.endsWith(`>${reduced}`)) {
    return !animated.startsWith(":root[");
  }
  return false;
}

export function missingReducedMotionSelectors(sheets) {
  const parsed = sheets.map(({ file, css }) => ({
    file,
    rules: parseRules(css.replace(/\/\*[\s\S]*?\*\//g, "")),
  }));
  const globalWildcard = parsed.some(({ rules }) =>
    rules.some(
      (rule) =>
        rule.media.some((item) => /prefers-reduced-motion:\s*reduce/.test(item)) &&
        calmsAnimation(rule.body) &&
        rule.selectors.includes("*"),
    ),
  );
  if (globalWildcard) return [];

  const missing = [];
  for (const { file, rules } of parsed) {
    const reducedSelectors = rules
      .filter((rule) => rule.media.some((item) => /prefers-reduced-motion:\s*reduce/.test(item)) && calmsAnimation(rule.body))
      .flatMap((rule) => rule.selectors);
    for (const rule of rules) {
      if (rule.media.some((item) => /prefers-reduced-motion:\s*(reduce|no-preference)/.test(item))) continue;
      if (!moving(rule.body)) continue;
      for (const selector of rule.selectors) {
        if (COLOUR_ONLY.has(selector)) continue;
        if (reducedSelectors.some((reduced) => selectorMatches(selector, reduced))) continue;
        missing.push(`${file}: ${selector}`);
      }
    }
  }
  return missing;
}

test("every animation stops or calms down when Windows asks for less motion", () => {
  const sheets = cssFiles(SRC).map((file) => ({
    file: path.relative(SRC, file).replaceAll("\\", "/"),
    css: readFileSync(file, "utf8"),
  }));
  assert.deepEqual(missingReducedMotionSelectors(sheets), []);
});

test("nested @-rules and substring selector collisions are caught while no-preference and global rules pass", () => {
  assert.deepEqual(
    missingReducedMotionSelectors([
      {
        file: "a.css",
        css: "@container (min-width: 100px) { .toast { animation: pop 160ms; } } @media (prefers-reduced-motion: reduce) { .toast-close { animation: none; } }",
      },
    ]),
    ["a.css: .toast"],
  );
  assert.deepEqual(
    missingReducedMotionSelectors([
      {
        file: "a.css",
        css: "@media (prefers-reduced-motion: no-preference) { .drawer { animation: open 160ms; } }",
      },
    ]),
    [],
  );
  assert.deepEqual(
    missingReducedMotionSelectors([
      {
        file: "base.css",
        css: "@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }",
      },
      {
        file: "feature.css",
        css: ".badge { animation: pulse 1s infinite; }",
      },
    ]),
    [],
  );
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
