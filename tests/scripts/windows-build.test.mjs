import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { windowsArtifact, windowsFiles, windowsOverlay } from "../../scripts/release/windows-build.mjs";

const config = (version, pubkey = "PUBKEY") => ({ version, plugins: { updater: { pubkey } } });

test("the CI build ships the shipped public key and makes no updater signatures", () => {
  assert.deepEqual(windowsOverlay(config("0.3.9"), "0.3.9"), {
    plugins: { updater: { pubkey: "PUBKEY" } },
    bundle: { createUpdaterArtifacts: false },
  });
});

test("a beta gets a numeric MSI version", () => {
  assert.deepEqual(windowsOverlay(config("0.3.9-beta.2"), "0.3.9-beta.2").bundle.windows, { wix: { version: "0.3.9.2" } });
});

test("a missing public key or another version stops the build", () => {
  assert.throws(() => windowsOverlay(config("0.3.9", " "), "0.3.9"), /pubkey/);
  assert.throws(() => windowsOverlay(config("0.3.8"), "0.3.9"), /not 0\.3\.9/);
});

test("the artifact is named by version and laid out like a local release folder", () => {
  assert.equal(windowsArtifact("0.3.9"), "fuyu-windows-0.3.9");
  const dir = mkdtempSync(join(tmpdir(), "fuyu-win-"));
  mkdirSync(join(dir, "bundle", "msi"), { recursive: true });
  writeFileSync(join(dir, "bundle", "msi", "Fuyu_0.3.9.2_x64_en-US.msi"), "");
  const files = windowsFiles(dir, "0.3.9-beta.2");
  assert.equal(files.installer, join(dir, "bundle", "nsis", "Fuyu_0.3.9-beta.2_x64-setup.exe"));
  assert.equal(files.msi, join(dir, "bundle", "msi", "Fuyu_0.3.9.2_x64_en-US.msi"));
  assert.equal(files.exe, join(dir, "fuyu.exe"));
  assert.equal(windowsFiles(join(dir, "none"), "0.3.9").msi, null);
});
