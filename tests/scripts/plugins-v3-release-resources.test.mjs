import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { RELEASE_RESOURCES, resourcesOverlay, SHIPPED_FILES } from "../../scripts/plugins-v3/release-resources.mjs";
import { windowsOverlay } from "../../scripts/release/windows-build.mjs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const MODULE = "scripts/plugins-v3/release-resources.mjs";

test("the host and the built-in plugins land side by side under plugins-v3", () => {
  assert.deepEqual(Object.values(RELEASE_RESOURCES).sort(), ["plugins-v3/builtins", "plugins-v3/host"]);
  for (const file of SHIPPED_FILES) assert.ok(Object.values(RELEASE_RESOURCES).some((dir) => file.startsWith(`${dir}/`)), file);
  assert.deepEqual(resourcesOverlay(), { bundle: { resources: { ...RELEASE_RESOURCES } } });
});

test("both Windows release overlays carry the same resources", () => {
  const ci = windowsOverlay({ version: "1.0.0", plugins: { updater: { pubkey: "KEY" } } }, "1.0.0");
  assert.deepEqual(ci.bundle.resources, { ...RELEASE_RESOURCES });
  const local = read("scripts/release/prepare-release-config.mjs");
  assert.match(local, /resources: releaseResources\(\)/);
  assert.match(local, /await prepareReleaseResources\(\)/);
});

test("the macOS release build bundles the resources after preparing them", () => {
  const workflow = read(".github/workflows/release-macos.yml");
  const prepare = workflow.indexOf(`run: node ${MODULE}\n`);
  const build = workflow.indexOf(`--config "$(node ${MODULE} --overlay)"`);
  assert.ok(prepare > 0 && build > prepare, "release-macos.yml prepares the resources, then passes them to the build");
  for (const file of SHIPPED_FILES) assert.ok(workflow.includes(file), `release-macos.yml checks ${file}`);
});

test("development builds and build:exe do not bundle the resources", () => {
  for (const file of ["src-tauri/tauri.conf.json", "src-tauri/tauri.macos.conf.json", "src-tauri/tauri.bundle-macos.conf.json", "scripts/build-app-macos.mjs", "scripts/build-exe.mjs"]) {
    const text = read(file);
    assert.ok(!text.includes("plugins-v3") && !text.includes("release-resources"), `${file} must not bundle the plugin host`);
  }
});

test("the Windows smoke test checks every shipped file", () => {
  const smoke = read("scripts/release/smoke-test.ps1");
  for (const file of SHIPPED_FILES) assert.ok(smoke.includes(file.replaceAll("/", "\\")), file);
});
