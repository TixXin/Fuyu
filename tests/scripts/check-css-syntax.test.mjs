import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkCssSyntax, cssSyntaxProblems } from "../../scripts/check-css-syntax.mjs";

const at = (css) => cssSyntaxProblems(css).map(({ line, column }) => `${line}:${column}`);

test("a selector function left open is reported at its bracket, not at the end of the file", () => {
  const css = [
    ".list { display: grid; }",
    ".stage--light :is(.card { background: white; }",
    ".stage { height: 100%; }",
  ].join("\n");
  assert.deepEqual(at(css), ["2:18"]);
  assert.match(cssSyntaxProblems(css)[0].message, /"\(" has no "\)" before the "\{" at 2:25/);
});

test("line numbers do not depend on the line ending", () => {
  assert.deepEqual(at(".a { color: red; }\r\n.b :is(.c { color: red; }\r\n"), ["2:7"]);
});

test("a block, bracket or closer without its partner is reported", () => {
  assert.deepEqual(at(".a { color: red;\n.b { color: blue; }"), ["1:4"]);
  assert.deepEqual(at(".a { color: red; }\n}"), ["2:1"]);
  assert.deepEqual(at(".a[data-x { color: red; }"), ["1:3"]);
  assert.deepEqual(at(".a { width: calc(1px + (2px * 3); }"), ["1:17"]);
  assert.deepEqual(at(".a { color: red; }\n/* never closed"), ["2:1"]);
  assert.deepEqual(at(".a::after { content: \"open;\n}"), ["1:22"]);
});

test("brackets inside strings, comments, escapes and bare url() are not counted", () => {
  const css = [
    "/* :is( and { stay open in a comment */",
    ".a::before { content: \"(\"; }",
    ".a::after { content: '}'; }",
    ".a[data-x=\"[\"] { color: red; }",
    ".a\\( { color: red; }",
    ".a { background: url(data:image/svg+xml;utf8,<svg viewBox='0 0 1 1'>{</svg>); }",
    ".a { background: url( \"a(b.png\" ); }",
    ".a { content: \"line one \\",
    "line two\"; }",
  ].join("\n");
  assert.deepEqual(at(css), []);
});

test("nested at-rules and selector functions that close are accepted", () => {
  const css = [
    "@media (min-width: 600px) {",
    "  @supports (display: grid) and (not (display: inline-grid)) {",
    "    .a :is(.b, .c:not([hidden])):focus-visible { width: calc((100% - 8px) / 2); }",
    "  }",
    "}",
  ].join("\n");
  assert.deepEqual(at(css), []);
});

test("the repository scan names the broken file and skips dependency folders", () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-check-css-"));
  try {
    mkdirSync(join(root, "src", "ui"), { recursive: true });
    mkdirSync(join(root, "src", "node_modules", "dep"), { recursive: true });
    writeFileSync(join(root, "src", "ui", "Good.css"), ".a { color: red; }\n");
    writeFileSync(join(root, "src", "ui", "Bad.css"), ".a :is(.b { color: red; }\n");
    writeFileSync(join(root, "src", "node_modules", "dep", "dep.css"), ".a {\n");
    const { checked, problems } = checkCssSyntax(root);
    assert.equal(checked, 2);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^src\/ui\/Bad\.css:1:7 /);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
