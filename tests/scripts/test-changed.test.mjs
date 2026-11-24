import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { closure, lintable, rustFilters, rustReaders, select, specifiers } from "../../scripts/test-changed.mjs";

const REPO = path.resolve(import.meta.dirname, "..", "..");

function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), "test-changed-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), text);
  }
  return root;
}

test("import specifiers cover static, side-effect, dynamic and CSS imports", () => {
  const text = 'import a from "./a";\nimport "./b.css";\nconst c = await import("./c.ts");\nexport { d } from "../d";\n@import "./e.css";';
  assert.deepEqual(specifiers(text), ["./a", "./b.css", "./c.ts", "../d", "./e.css"]);
});

test("a page or test is picked when a file it imports, directly or not, changed", (t) => {
  const root = fixture({
    "tests/regression/a.html": '<script type="module" src="./a.tsx"></script>',
    "tests/regression/a.tsx": 'import { App } from "../../src/App";',
    "tests/regression/b.html": '<script type="module" src="/tests/regression/b.tsx"></script>',
    "tests/regression/b.tsx": 'import "../../src/other.ts";',
    "src/App.tsx": 'import "./App.css";\nimport { x } from "./lib/x";',
    "src/App.css": ".a {}",
    "src/lib/x.ts": "export const x = 1;",
    "src/other.ts": "export {};",
    "tests/unit/x.test.mjs": 'import { x } from "../../src/lib/x.ts";',
    "tests/unit/css.test.mjs": 'const file = "src/App.css";',
    "tests/unit/none.test.mjs": "export {};",
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const unitTests = ["x", "css", "none"].map((name) => path.join(root, "tests", "unit", `${name}.test.mjs`));
  const picked = (changed) => select({ changed, pages: ["a.html?test=1", "b.html"], unitTests, root });
  assert.deepEqual(picked(["src/lib/x.ts"]), { pages: ["a.html?test=1"], tests: ["tests/unit/x.test.mjs"], rust: null });
  assert.deepEqual(picked(["src/App.css"]).tests, ["tests/unit/css.test.mjs"]);
  assert.deepEqual(picked(["src/App.css"]).pages, ["a.html?test=1"]);
  assert.deepEqual(picked(["src/other.ts"]).pages, ["b.html"]);
  assert.deepEqual(picked(["tests/unit/none.test.mjs"]).tests, ["tests/unit/none.test.mjs"]);
  assert.ok(closure(path.join(root, "src", "App.tsx"), root).has("src/lib/x.ts"));
});

test("builtins-off runs only the part of the switched-off feature whose files changed, and every part for shared code", (t) => {
  const root = fixture({
    "tests/regression/builtins-off.html": '<script type="module" src="/tests/regression/builtins-off.tsx"></script>',
    "tests/regression/builtins-off.tsx": 'import "../../src/windows/island/shell.ts";',
    "src/windows/island/shell.ts": "export {};",
    "src/features/timer/plugin/island.tsx": "export {};",
    "src/features/media/MusicPlayerPanel.tsx": "export {};",
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pages = ["builtins-off.html?self", "builtins-off.html?only=timer", "builtins-off.html?only=music"];
  const picked = (changed) => select({ changed, pages, unitTests: [], root }).pages;
  assert.deepEqual(picked(["src/features/timer/plugin/island.tsx"]), ["builtins-off.html?only=timer"]);
  assert.deepEqual(picked(["src/features/media/MusicPlayerPanel.tsx"]), ["builtins-off.html?only=music"]);
  assert.deepEqual(picked(["src/windows/island/shell.ts"]), pages);
  assert.deepEqual(picked(["tests/regression/builtins-off.html"]), pages);
  assert.deepEqual(picked(["src/elsewhere.ts"]), []);
});

test("Rust changes run the tests of the touched modules, anything else runs the whole lib", () => {
  assert.equal(rustFilters(["src/a.ts"]), null);
  assert.deepEqual(rustFilters(["src-tauri/src/island/geometry.rs", "src-tauri/src/island/tests.rs", "src-tauri/src/tray.rs"]), ["island::", "tray::"]);
  assert.deepEqual(rustFilters(["src-tauri/src/lib.rs"]), []);
  assert.deepEqual(rustFilters(["src-tauri/Cargo.toml"]), []);
});

test("a data file outside src-tauri runs the tests of the Rust modules that read it", (t) => {
  const root = fixture({
    "src/features/builtins.json": "[]",
    "src/features/timer/island.tsx": "export {};",
    "packages/generated/rust.mjs": "export {};",
    "src-tauri/tauri.conf.json": "{}",
    "src-tauri/src/plugin_kernel/builtins.rs": 'const CATALOG: &str = include_str!("../../../src/features/builtins.json");',
    "src-tauri/src/plugin_kernel/mod.rs": 'fn dir() -> PathBuf { PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/features") }',
    "src-tauri/src/plugin_kernel/tests.rs": 'const GENERATED: &str = "../packages/generated";\nconst CONF: &str = include_str!("../../tauri.conf.json");',
    "src-tauri/src/pets/tests.rs": 'assert!(reject("../x.webp"));',
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const readers = rustReaders(root);
  const rust = (changed) => select({ changed, pages: [], unitTests: [], root, readers }).rust;
  assert.deepEqual(rust(["src/features/builtins.json"]), ["plugin_kernel::"]);
  assert.deepEqual(rust(["packages/generated/rust.mjs"]), ["plugin_kernel::"]);
  assert.equal(rust(["src/features/timer/island.tsx"]), null);
  assert.deepEqual(rust(["src/features/builtins.json", "src-tauri/src/pets/mod.rs"]), ["pets::", "plugin_kernel::"]);
  assert.deepEqual(rust(["src/features/builtins.json", "src-tauri/tauri.conf.json"]), []);
});

test("in this repo, changing builtins.json runs the plugin_kernel tests (0.3.12 slipped past test:changed)", () => {
  assert.deepEqual(rustFilters(["src/features/builtins.json"], rustReaders(REPO)), ["plugin_kernel::"]);
});

test("ESLint gets the changed scripts that still exist, not Rust, styles or deleted files", () => {
  const exists = (file) => !file.endsWith("gone.ts");
  assert.deepEqual(
    lintable(["src/features/agent-status/useFullscreenAgentAlerts.ts", "scripts/mq/wait.mjs", "src/a.css", "src-tauri/src/lib.rs", "src-tauri/scripts/x.mjs", "src/gone.ts", "docs/x.md"], exists),
    ["src/features/agent-status/useFullscreenAgentAlerts.ts", "scripts/mq/wait.mjs"],
  );
});
