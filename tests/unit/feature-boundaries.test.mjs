import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ALLOWLIST = JSON.parse(readFileSync(join(ROOT, "scripts/feature-boundary-allowlist.json"), "utf8"));
const IMPORT = /(?:(?:import|export)\s[^'";]*?from\s*|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+)\1/g;
const EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".mjs", ".js", "/index.ts", "/index.tsx"];

function sourceFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (/\.(tsx?|mts|mjs|js|css)$/.test(entry.name)) found.push(path);
  }
  return found;
}

function resolveImport(from, specifier) {
  const base = resolve(dirname(from), specifier);
  for (const extension of EXTENSIONS) {
    const path = base + extension;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const repoPath = (path) => relative(ROOT, path).replaceAll("\\", "/");
const featureOf = (path) => path.match(/^src\/features\/([^/]+)\//)?.[1] ?? null;
const sharedLayer = (path) => /^src\/(lib|components|utils)\//.test(path);
const PLATFORM = "plugin-kernel";
const SHELL_READS = new Set([PLATFORM]);
const isShell = (path) => path.startsWith("src/windows/island/");

function crossings() {
  const features = [];
  const shared = [];
  const windows = [];
  const island = [];
  for (const file of sourceFiles(join(ROOT, "src"))) {
    const from = repoPath(file);
    for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const target = resolveImport(file, match[2]);
      if (!target) continue;
      const to = repoPath(target);
      if (featureOf(from) && to.startsWith("src/windows/")) windows.push(`${from} -> ${to}`);
      const toFeature = featureOf(to);
      if (!toFeature) continue;
      if (isShell(from) && !SHELL_READS.has(toFeature)) island.push(`${from} -> ${to}`);
      const fromFeature = featureOf(from);
      if (fromFeature && toFeature !== PLATFORM && fromFeature !== toFeature) features.push(`${from} -> ${to}`);
      else if (sharedLayer(from)) shared.push(`${from} -> ${to}`);
    }
  }
  return { features: [...new Set(features)].sort(), shared: [...new Set(shared)].sort(), windows: [...new Set(windows)].sort(), island: [...new Set(island)].sort() };
}

function compare(kind, found, allowed) {
  const extra = found.filter((edge) => !allowed.includes(edge));
  const gone = allowed.filter((edge) => !found.includes(edge));
  assert.deepEqual(extra, [], `${kind}: new imports across the boundary. Go through a service, or lift the shared code into src/lib, src/components or src/utils.`);
  assert.deepEqual(gone, [], `${kind}: these imports are gone, remove them from scripts/feature-boundary-allowlist.json.`);
}

test("a feature does not import another feature, except what the allowlist still holds", () => {
  compare("features", crossings().features, ALLOWLIST.features);
});

test("src/lib, src/components and src/utils do not import features, except what the allowlist still holds", () => {
  compare("shared", crossings().shared, ALLOWLIST.shared);
});

test("a feature does not import a window", () => {
  assert.deepEqual(crossings().windows, [], "Features sit below the windows: take slot handles from src/features/plugin-kernel, and move what a window shares into src/lib or src/components.");
});

test("the allowlist is sorted and has no duplicates", () => {
  for (const kind of ["features", "shared"]) {
    assert.deepEqual(ALLOWLIST[kind], [...new Set(ALLOWLIST[kind])].sort(), kind);
  }
});

test("the island shell imports no feature besides the plugin kernel", () => {
  assert.deepEqual(crossings().island, [], "The shell reads what features contribute: register a slot item or a runner in src/features/<feature>/plugin/ instead.");
});

test("every removedBy entry names an edge the allowlist still holds and a task that is still open", () => {
  const held = new Set([...ALLOWLIST.features, ...ALLOWLIST.shared]);
  for (const [edge, task] of Object.entries(ALLOWLIST.removedBy ?? {})) {
    assert.ok(held.has(edge), `removedBy names an edge that is not in the allowlist: ${edge}`);
    const group = task.match(/^[A-Z]+/)?.[0] ?? "";
    assert.ok(existsSync(join(ROOT, "docs/tasks", group, `${task}.md`)), `${task} is done or missing, but ${edge} is still allowed: remove the import or name the task that will`);
  }
});
