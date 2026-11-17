import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runMinimalApp } from "../examples/minimal-app/run.mjs";

const EXAMPLE_ROOT = fileURLToPath(new URL("../examples/minimal-app", import.meta.url));
const ALLOWED_IMPORTS = [/^node:/, /^ws$/, /^\.\.?\//, /^@fuyu\/plugin-base(\/|$)/];

function listModules(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listModules(full);
    return /\.mjs$/.test(entry.name) ? [full] : [];
  });
}

test("the minimal application imports only Node, ws, @fuyu/plugin-base and its own files", () => {
  const disallowed = [];
  for (const file of listModules(EXAMPLE_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const [, specifier] of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      if (!ALLOWED_IMPORTS.some((pattern) => pattern.test(specifier))) {
        disallowed.push(`${relative(EXAMPLE_ROOT, file)}: ${specifier}`);
      }
    }
  }
  assert.deepEqual(disallowed, []);
});

test("a minimal application without Fuyu business code runs end-to-end across shell, host, services and window slots", async () => {
  const result = await runMinimalApp();
  assert.equal(result.protocol, 2);
  assert.equal(result.initialPanel, "1 notes, 2 words");
  assert.deepEqual(result.addedNote, { id: 2, text: "plugin base works" });
  assert.equal(result.updatedPanel, "2 notes, 5 words");
  assert.deepEqual(result.allNotes, [
    { id: 1, text: "hello world" },
    { id: 2, text: "plugin base works" },
  ]);
  assert.deepEqual(result.heardNotes, [{ id: 2, text: "plugin base works" }]);
  assert.deepEqual(result.pluginMessages, [
    {
      plugin: "word-count",
      topic: "updated",
      data: { notes: 2, words: 5 },
    },
  ]);
  assert.equal(result.slotsAfterDisable, 0);
  assert.equal(result.exitCode, 0);
});
