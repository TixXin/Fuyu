import assert from "node:assert/strict";
import { test } from "node:test";
import { compare, motionLiterals } from "../../scripts/check-motion.mjs";

const lines = (css) => motionLiterals(css).map(({ line }) => line);

test("hard-coded curves, ease keywords and literal durations are found", () => {
  const css = [
    ".a {",
    "  transition: opacity var(--motion-base) cubic-bezier(0.2, 0.8, 0.2, 1);",
    "  animation: fade var(--motion-base) ease-out;",
    "  transition: color 140ms var(--motion-ease);",
    "  transition-duration: 0.2s;",
    "  animation-timing-function: ease-in-out;",
    "}",
  ].join("\n");
  assert.deepEqual(lines(css), [2, 3, 4, 5, 6]);
});

test("tokens, linear, delays, loops and the reduced-motion 1ms are allowed", () => {
  const css = [
    ".a {",
    "  transition: color var(--motion-fast) var(--motion-ease), background var(--motion-base) var(--motion-ease) 120ms;",
    "  animation: spin 900ms linear infinite;",
    "  animation: breathe 2.4s var(--motion-ease-in-out) infinite;",
    "  transition: --glass-c1 1200ms var(--motion-ease);",
    "  animation: pop var(--motion-slow) var(--motion-ease-out) 200ms backwards;",
    "  animation-duration: 1ms;",
    "  transition: none;",
    "}",
    "/* transition: color 140ms ease; */",
  ].join("\n");
  assert.deepEqual(lines(css), []);
});

test("values inside a var() fallback are left to the token that owns them, one beside it still counts", () => {
  assert.deepEqual(lines(".a { transition: opacity var(--island-motion-layer, 120ms) var(--x, ease); }"), []);
  assert.deepEqual(lines(".a { transition: opacity var(--island-motion-layer, 120ms) ease; }"), [1]);
});

test("the allowlist only shrinks", () => {
  const allowlist = { "a.css": { count: 2, reason: "r" }, "gone.css": { count: 1, reason: "r" } };
  assert.deepEqual(compare({ "a.css": 2 }, allowlist).length, 1);
  assert.match(compare({ "a.css": 3, "gone.css": 1 }, allowlist)[0], /3 hard-coded/);
  assert.match(compare({ "a.css": 1, "gone.css": 1 }, allowlist)[0], /lower its allowlist entry/);
  assert.deepEqual(compare({ "a.css": 2, "gone.css": 1 }, allowlist), []);
  assert.match(compare({ "new.css": 1, "a.css": 2, "gone.css": 1 }, allowlist)[0], /new\.css: 1 hard-coded motion value\(s\), 0 allowed/);
});
