import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadMap, writeExport } from "../../scripts/cordis/export.mjs";
import { brokenImports, compare, exportFiles, fuyuNames } from "../../scripts/cordis/transform.mjs";

function put(root, rel, text) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
}

function withRepo(run) {
  const root = mkdtempSync(path.join(tmpdir(), "cordis-export-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const map = { ...loadMap(), fuyuOnly: ["packages/plugin-base/src/host/island.mjs"], overrides: {} };

test("the export lays Fuyu's files out the way tauri-cordis 0.2.0 does", () => {
  withRepo((root) => {
    put(root, "packages/plugin-base/src/host/kernel.mjs", 'import Loader from "@cordisjs/loader";\nimport { Context } from "cordis";\nconst HMR = import.meta.resolve("@cordisjs/hmr");\n');
    put(root, "packages/plugin-review/src/files.mjs", 'import { a } from "@fuyu/plugin-manifest";\nimport { b } from "../../plugin-manifest/src/executable.mjs";\n');
    put(root, "src-tauri/crates/plugin-base-macros/src/lib.rs", "quote!(::plugin_base::Call);\npub use plugin_base_macros::host_service;\n");
    put(root, "vendor/cordis/fs/lib/index.js", 'import { Service } from "cordis";\n');
    put(root, "vendor/cordis/fs/node_modules/x/index.js", "");
    const files = exportFiles(root, map);
    const text = (rel) => files.get(rel).toString("utf8");
    assert.equal(text("packages/tauri-cordis/src/host/kernel.mjs"), 'import Loader from "../../vendor/cordis/loader/lib/index.js";\nimport { Context } from "../../vendor/cordis/core/lib/index.js";\nconst HMR = import.meta.resolve("../../vendor/cordis/hmr/lib/index.js");\n');
    assert.equal(text("packages/review/src/files.mjs"), 'import { a } from "@tauri-cordis/manifest";\nimport { b } from "../../manifest/src/executable.mjs";\n');
    assert.equal(text("crates/tauri-cordis-macros/src/lib.rs"), "quote!(::tauri_cordis::Call);\npub use tauri_cordis_macros::host_service;\n");
    assert.equal(text("packages/tauri-cordis/vendor/cordis/fs/lib/index.js"), 'import { Service } from "../../core/lib/index.js";\n');
    assert.ok(![...files.keys()].some((rel) => rel.includes("node_modules")));
  });
});

test("Fuyu-only files stay out, and an exported file that still imports one is reported", () => {
  withRepo((root) => {
    put(root, "packages/plugin-base/src/host/island.mjs", "export const ISLAND = 1;\n");
    put(root, "packages/plugin-base/src/host/main.mjs", 'import { ISLAND } from "./island.mjs";\nimport { x } from "@fuyu/plugin-services";\n');
    const files = exportFiles(root, map);
    assert.equal(files.has("packages/tauri-cordis/src/host/island.mjs"), false);
    assert.deepEqual(brokenImports(files).map((item) => item.specifier), ["./island.mjs", "@fuyu/plugin-services"]);
  });
});

test("Fuyu names are reported everywhere except test fixtures", () => {
  withRepo((root) => {
    put(root, "packages/plugin-cli/src/cli.mjs", 'const HELP = "Usage: fuyu-plugin";\n');
    put(root, "packages/plugin-cli/test/fixtures/hello/package.json", '{ "fuyu": {} }\n');
    const hits = fuyuNames(map, exportFiles(root, map));
    assert.deepEqual(hits.map((hit) => `${hit.path}:${hit.line}`), ["packages/cli/src/cli.mjs:1"]);
  });
});

test("writing the export makes the checkout match it and removes managed files Fuyu dropped", () => {
  withRepo((root) => {
    const cordis = path.join(root, "cordis");
    put(root, "packages/plugin-market/src/index.mjs", "export {};\n");
    put(cordis, "packages/market/src/old.mjs", "stale\n");
    put(cordis, "packages/market/README.md", "kept\n");
    const files = exportFiles(root, map);
    assert.deepEqual(compare(files, cordis, map), { differs: [], missing: ["packages/market/src/index.mjs"], extra: ["packages/market/src/old.mjs"] });
    writeExport(files, cordis, map);
    assert.deepEqual(compare(files, cordis, map), { differs: [], missing: [], extra: [] });
    assert.equal(existsSync(path.join(cordis, "packages/market/src/old.mjs")), false);
    assert.equal(readFileSync(path.join(cordis, "packages/market/README.md"), "utf8"), "kept\n");
  });
});

test("an override puts tauri-cordis's own copy of a Fuyu-only file in the export, unchanged", () => {
  withRepo((root) => {
    put(root, "packages/plugin-base/src/host/island.mjs", 'export const APP = "fuyu";\n');
    put(root, "neutral/island.mjs", 'export const APP = "@fuyu/plugin-base";\n');
    const files = exportFiles(root, { ...map, overrides: { "packages/tauri-cordis/src/host/island.mjs": "neutral/island.mjs" } });
    assert.equal(files.get("packages/tauri-cordis/src/host/island.mjs").toString("utf8"), 'export const APP = "@fuyu/plugin-base";\n');
  });
});
