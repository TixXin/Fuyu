import assert from "node:assert/strict";
import { test } from "node:test";
import { colorLiterals, compare } from "../../scripts/check-colors.mjs";

const lines = (css) => colorLiterals(css).map(({ line }) => line);

test("literal colours in text, fill and border properties are found", () => {
  const css = ".a {\n  color: #fff;\n  background: rgba(255, 255, 255, 0.1);\n  border: 1px solid white;\n  stroke: rgb(0 0 0 / 50%);\n}";
  assert.deepEqual(lines(css), [2, 3, 4, 5]);
});

test("tokens, fallbacks, shadows and keywords are allowed", () => {
  const css = [
    ".a {",
    "  --ink: #fff;",
    "  color: var(--error-text, #ff9aa9);",
    "  background: rgba(var(--overlay-rgb, 255, 255, 255), 0.06);",
    "  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);",
    "  border-color: transparent;",
    "  fill: currentColor;",
    "}",
  ].join("\n");
  assert.deepEqual(lines(css), []);
});

test("rules for a light island and comments do not count", () => {
  const css = "/* color: #fff; */\n.island-light .a { color: #18181e; }\n.settings-stage--light .b { background: #ffffff; }\n@media (max-width: 600px) {\n  .c { color: #fff; }\n}";
  assert.deepEqual(lines(css), [5]);
});

test("files may only lose literals, and the allowlist follows them down", () => {
  assert.deepEqual(compare({ "a.css": 2 }, { "a.css": 2 }), []);
  assert.equal(compare({ "a.css": 3 }, { "a.css": 2 }).length, 1);
  assert.equal(compare({ "b.css": 1 }, {}).length, 1);
  assert.match(compare({ "a.css": 1 }, { "a.css": 2 })[0], /lower/);
  assert.match(compare({}, { "a.css": 2 })[0], /remove/);
});
