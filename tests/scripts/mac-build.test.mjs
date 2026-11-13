import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { macArtifact, macFiles, signerArgs } from "../../scripts/release/mac-build.mjs";

test("the macOS build hands over an app archive, its signature and a dmg named by version", () => {
  assert.equal(macArtifact("0.3.9"), "fuyu-macos-0.3.9");
  const files = macFiles("out", "0.3.9");
  assert.equal(files.archive, join("out", "Fuyu_0.3.9_aarch64.app.tar.gz"));
  assert.equal(files.signature, join("out", "Fuyu_0.3.9_aarch64.app.tar.gz.sig"));
  assert.equal(files.dmg, join("out", "Fuyu_0.3.9_aarch64.dmg"));
});

test("a key file is passed with -f and dropped from the environment, key text stays in the environment", () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-signer-"));
  const key = join(dir, "fuyu.key");
  writeFileSync(key, "secret");
  const fromFile = signerArgs({ TAURI_SIGNING_PRIVATE_KEY: key, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "pw" }, "a.tar.gz");
  assert.deepEqual(fromFile.args, ["tauri", "signer", "sign", "-f", key, "a.tar.gz"]);
  assert.equal(fromFile.env.TAURI_SIGNING_PRIVATE_KEY, undefined);
  assert.equal(fromFile.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD, "pw");
  const fromText = signerArgs({ TAURI_SIGNING_PRIVATE_KEY: "dW50cnVzdGVk" }, "a.tar.gz");
  assert.deepEqual(fromText.args, ["tauri", "signer", "sign", "a.tar.gz"]);
  assert.equal(fromText.env.TAURI_SIGNING_PRIVATE_KEY, "dW50cnVzdGVk");
});
