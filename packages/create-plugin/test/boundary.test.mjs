import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const ALLOWED = [/^node:/, /^\.\.?\//, /^@fuyu\/plugin-manifest(\/|$)/];
const TEMPLATE_ALLOWED = [/^\.\//, /^react$/, /^typescript-eslint$/, /^@fuyu\/plugin-(base|services)$/];

function files(dir, pattern) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, pattern);
    return pattern.test(entry.name) ? [path] : [];
  });
}

function strays(list, allowed, base) {
  const found = [];
  for (const file of list) {
    const text = readFileSync(file, "utf8");
    for (const [, specifier] of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const outside = specifier.startsWith(".") && relative(base, join(file, "..", specifier)).startsWith("..");
      if (outside || !allowed.some((pattern) => pattern.test(specifier))) found.push(`${relative(root, file)}: ${specifier}`);
    }
  }
  return found;
}

test("@fuyu/create-plugin imports nothing from the app, only Node and the allowed packages", () => {
  const list = [...files(join(root, "src"), /\.(mjs|mts)$/), ...files(join(root, "bin"), /\.(mjs|mts)$/)];
  assert.deepEqual(strays(list, ALLOWED, root), []);
});

test("the template only imports its own files, React, and the plugin packages it lists", () => {
  const template = join(root, "template");
  assert.deepEqual(strays(files(template, /\.(ts|tsx|mjs)$/), TEMPLATE_ALLOWED, template), []);
});
