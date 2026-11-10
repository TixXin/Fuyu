import assert from "node:assert/strict";
import test from "node:test";
import { TRANSFORMS, flattenCommand, looksLikeSplitCommand, toHalfWidth } from "../../src/features/clipboard/textTransforms.ts";

const run = (id, text, html) => TRANSFORMS.find((t) => t.id === id).run({ text, html });
const block = (id, text, html) => TRANSFORMS.find((t) => t.id === id).block?.({ text, html }) ?? null;

test("a command split over lines becomes one line", () => {
  assert.equal(flattenCommand("cargo test --manifest-path src-tauri/Cargo.toml \\\n  --quiet"), "cargo test --manifest-path src-tauri/Cargo.toml --quiet");
  assert.equal(flattenCommand("$ cd app\n$ pnpm install"), "cd app && pnpm install");
  assert.equal(flattenCommand("PS D:/repo> Get-Item a `\n  -Force"), "Get-Item a -Force");
  assert.equal(flattenCommand("docker run\n  -p 80:80\n  nginx"), "docker run -p 80:80 nginx");
  assert.ok(looksLikeSplitCommand("a \\\nb"));
  assert.ok(!looksLikeSplitCommand("first line\nsecond line"));
});

test("text transforms run locally and say when they would not apply", () => {
  assert.equal(run("jsonPretty", '{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(block("jsonPretty", "plain"), "notJson");
  assert.equal(run("camel", "hello big world"), "helloBigWorld");
  assert.equal(run("snake", "Hello Big-World"), "hello_big_world");
  assert.equal(run("urlDecode", "a%20b"), "a b");
  assert.equal(block("stripTracking", "no link here"), "noLink");
  assert.equal(block("markdown", "x"), "noHtml");
  assert.equal(block("markdown", "x", "<b>x</b>"), null);
  assert.equal(block("upper", "ABC"), "noChange");
  assert.equal(run("dedupeLines", "a\nb\na"), "a\nb");
  assert.equal(toHalfWidth("ＡＢＣ１２３，　ok"), "ABC123, ok");
});
