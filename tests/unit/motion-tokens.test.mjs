import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as tokens from "../../src/lib/theme/motionTokens.ts";

const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8").replace(/\r/g, "");
const start = css.indexOf(":root {");
const root = css.slice(start, css.indexOf("}", start));

function cssToken(name) {
  const match = root.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `--${name} missing from :root in tokens.css`);
  return match[1].trim();
}

const CURVES = { "motion-ease": "MOTION_EASE", "motion-ease-out": "MOTION_EASE_OUT", "motion-ease-in-out": "MOTION_EASE_IN_OUT" };
const DURATIONS = { "motion-fast": "MOTION_FAST_MS", "motion-base": "MOTION_BASE_MS", "motion-medium": "MOTION_MEDIUM_MS", "motion-slow": "MOTION_SLOW_MS" };

test("motion curves in motionTokens.ts match tokens.css", () => {
  for (const [name, exported] of Object.entries(CURVES)) assert.equal(tokens[exported], cssToken(name), name);
});

test("motion durations in motionTokens.ts match tokens.css", () => {
  for (const [name, exported] of Object.entries(DURATIONS)) assert.equal(`${tokens[exported]}ms`, cssToken(name), name);
});

test("motionTokens.ts and tokens.css define the same set of motion tokens", () => {
  assert.deepEqual(Object.keys(tokens).sort(), [...Object.values(CURVES), ...Object.values(DURATIONS)].sort());
  const defined = [...root.matchAll(/--(motion-[\w-]+):/g)].map((m) => m[1]).sort();
  assert.deepEqual(defined, [...Object.keys(CURVES), ...Object.keys(DURATIONS)].sort());
});
