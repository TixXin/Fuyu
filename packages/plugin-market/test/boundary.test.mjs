import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const ALLOWED = [/^node:/, /^\.\.?\//, /^@fuyu\/plugin-(manifest|market)(\/|$)/];

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.(mjs|mts)$/.test(entry.name) ? [path] : [];
  });
}

test("@fuyu/plugin-market imports nothing from the app, only Node and the allowed packages", () => {
  const strays = [];
  for (const file of files(join(root, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const [, specifier] of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const outside = specifier.startsWith(".") && relative(root, join(file, "..", specifier)).startsWith("..");
      if (outside || !ALLOWED.some((pattern) => pattern.test(specifier))) strays.push(`${relative(root, file)}: ${specifier}`);
    }
  }
  assert.deepEqual(strays, []);
});
