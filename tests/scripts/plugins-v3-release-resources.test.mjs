import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { BUILD_APP_ARGS, BUNDLE_CONFIG } from "../../scripts/build-app-macos.mjs";
import { BUILD_EXE_ARGS } from "../../scripts/build-exe.mjs";
import { RELEASE_RESOURCES, resourcesOverlay, SHIPPED_FILES, verifyShippedResources } from "../../scripts/plugins-v3/release-resources.mjs";
import { macOverlay, verifyMacResources } from "../../scripts/release/mac-build.mjs";
import { localReleaseOverlay } from "../../scripts/release/prepare-release-config.mjs";
import { windowsOverlay } from "../../scripts/release/windows-build.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

test("the host and the built-in plugins land side by side under plugins-v3", () => {
  assert.deepEqual(Object.values(RELEASE_RESOURCES).sort(), ["plugins-v3/builtins", "plugins-v3/host"]);
  for (const file of SHIPPED_FILES) assert.ok(Object.values(RELEASE_RESOURCES).some((dir) => file.startsWith(`${dir}/`)), file);
  assert.deepEqual(resourcesOverlay(), { bundle: { resources: { ...RELEASE_RESOURCES } } });
});

test("Windows, macOS and local release overlays all carry the same resources", () => {
  const base = { version: "1.0.0", plugins: { updater: { pubkey: "KEY" } } };
  const win = windowsOverlay(base, "1.0.0");
  const local = localReleaseOverlay(base, { TAURI_UPDATER_PUBKEY: "KEY" });
  const mac = macOverlay();
  assert.deepEqual(win.bundle.resources, { ...RELEASE_RESOURCES });
  assert.deepEqual(local.bundle.resources, { ...RELEASE_RESOURCES });
  assert.deepEqual(mac.bundle.resources, { ...RELEASE_RESOURCES });
  assert.equal(mac.bundle.createUpdaterArtifacts, false);
});

test("installed and macOS bundle verifiers check every shipped file from the single list", () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-release-resources-"));
  const appDir = join(root, "Fuyu.app");
  const resourcesDir = join(appDir, "Contents", "Resources");
  for (const file of SHIPPED_FILES) {
    const full = join(resourcesDir, file);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, "ok");
  }
  verifyShippedResources(resourcesDir);
  verifyMacResources(appDir);

  for (const file of SHIPPED_FILES) {
    const full = join(resourcesDir, file);
    unlinkSync(full);
    assert.throws(() => verifyShippedResources(resourcesDir), new RegExp(file.replaceAll("/", "[/\\\\]")));
    assert.throws(() => verifyMacResources(appDir), new RegExp(file.replaceAll("/", "[/\\\\]")));
    writeFileSync(full, "ok");
  }
  rmSync(root, { recursive: true, force: true });
});

test("development builds and build:exe do not bundle the resources", () => {
  const releaseKeys = new Set(Object.keys(RELEASE_RESOURCES));
  const releaseValues = new Set(Object.values(RELEASE_RESOURCES));
  for (const file of ["src-tauri/tauri.conf.json", "src-tauri/tauri.macos.conf.json", BUNDLE_CONFIG]) {
    const resources = readJson(file).bundle?.resources ?? {};
    for (const [key, value] of Object.entries(resources)) {
      assert.ok(!releaseKeys.has(key) && !releaseValues.has(value), `${file} must not bundle ${key} -> ${value}`);
    }
  }
  for (const args of [BUILD_APP_ARGS, BUILD_EXE_ARGS]) {
    assert.ok(!args.some((arg) => arg.includes("tauri.release.conf.json") || arg.includes("resources")), args.join(" "));
  }
});
