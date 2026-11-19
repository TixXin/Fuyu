import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { planInvocation } from "../../scripts/macos/dev-cargo.mjs";
import { cargoOriginal, replaceWithCopy, DEV_IDENTIFIER, DEV_IDENTITY, devSigningDir, parseSha1Fingerprint, signedByDevIdentity } from "../../scripts/macos/dev-signing.mjs";
import { IDENTITY } from "../../scripts/macos/self-signed-cert.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cwd = "/repo/src-tauri";
const mac = { env: {}, cwd, platform: "darwin" };

test("tauri dev's run and a debug build are signed, the binary found in cargo's target dir", () => {
  const dev = planInvocation(["run", "--no-default-features", "--color", "always", "--", "--flag"], mac);
  assert.equal(dev.mode, "run");
  assert.deepEqual(dev.buildArgs, ["build", "--no-default-features", "--color", "always"]);
  assert.equal(dev.binary, path.resolve(cwd, "target/debug/fuyu"));
  assert.equal(planInvocation(["build", "--features", "x"], mac).mode, "build");
  assert.equal(planInvocation(["build", "--profile", "dev"], mac).mode, "build");
  assert.equal(planInvocation(["run", "--", "--release"], mac).mode, "run", "arguments for the app are not cargo's");
});

test("release builds, other profiles, other binaries and other platforms pass straight through", () => {
  for (const args of [
    ["build", "--release"],
    ["build", "-r"],
    ["run", "--release", "--", "x"],
    ["build", "--profile", "release"],
    ["build", "--profile=bench"],
    ["build", "--bin", "other"],
    ["build", "--example", "qq_probe"],
    ["test"],
    ["check"],
    [],
  ]) {
    assert.equal(planInvocation(args, mac).mode, "passthrough", args.join(" "));
  }
  assert.equal(planInvocation(["run"], { ...mac, platform: "win32" }).mode, "passthrough");
});

test("the binary path follows --target-dir, CARGO_TARGET_DIR and --target", () => {
  assert.equal(planInvocation(["build", "--target-dir", "/t"], mac).binary, path.resolve("/t/debug/fuyu"));
  assert.equal(planInvocation(["build"], { ...mac, env: { CARGO_TARGET_DIR: "target/agents" } }).binary, path.resolve(cwd, "target/agents/debug/fuyu"));
  assert.equal(planInvocation(["build", "--target", "aarch64-apple-darwin"], mac).binary, path.resolve(cwd, "target/aarch64-apple-darwin/debug/fuyu"));
});

test("the development identity is its own certificate, apart from the release one", () => {
  assert.notEqual(DEV_IDENTITY, IDENTITY);
  assert.equal(devSigningDir("/home/.tauri/fuyu"), path.join("/home/.tauri/fuyu", "macos-dev"));
  assert.equal(parseSha1Fingerprint("sha1 Fingerprint=AB:cd:01\n"), "ABCD01");
  assert.throws(() => parseSha1Fingerprint("nothing"));
  assert.equal(signedByDevIdentity(`Identifier=${DEV_IDENTIFIER}\nAuthority=${DEV_IDENTITY}\n`), true);
  assert.equal(signedByDevIdentity("Identifier=fuyu-2f0e931a\nSignature=adhoc\n"), false);
});

test("the original that cargo copies the binary from is found in deps, so the copy it makes again is signed", () => {
  const debug = mkdtempSync(path.join(tmpdir(), "fuyu-deps-"));
  mkdirSync(path.join(debug, "deps"));
  const binary = path.join(debug, "fuyu");
  writeFileSync(binary, "second");
  writeFileSync(path.join(debug, "deps", "fuyu-0123456789abcdef"), "first!");
  writeFileSync(path.join(debug, "deps", "fuyu-fedcba9876543210"), "second");
  writeFileSync(path.join(debug, "deps", "fuyu-fedcba9876543210.d"), "second");
  assert.equal(cargoOriginal(binary), path.join(debug, "deps", "fuyu-fedcba9876543210"));
  writeFileSync(binary, "other!");
  assert.equal(cargoOriginal(binary), null);
});

test("the signed copy replaces the binary as a new file, so macOS does not reuse a cached signature", { skip: process.platform === "win32" }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fuyu-replace-"));
  const source = path.join(dir, "original");
  const target = path.join(dir, "fuyu");
  writeFileSync(source, "signed");
  chmodSync(source, 0o755);
  writeFileSync(target, "old");
  const before = statSync(target).ino;
  replaceWithCopy(source, target);
  assert.notEqual(statSync(target).ino, before);
  assert.equal(readFileSync(target, "utf8"), "signed");
  assert.equal(statSync(target).mode & 0o777, 0o755);
  assert.deepEqual(readdirSync(dir).sort(), ["fuyu", "original"]);
});

test("the runner builds before run, then hands over to cargo run, and passes exit codes back", { skip: process.platform === "win32" }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fuyu-dev-cargo-"));
  const log = path.join(dir, "cargo.log");
  const cargo = path.join(dir, "cargo");
  writeFileSync(cargo, `#!/bin/sh\necho "$*" >> "${log}"\n[ "$1" = check ] && exit 3\nexit 0\n`);
  chmodSync(cargo, 0o755);
  const runner = path.join(root, "scripts/macos/dev-cargo.sh");
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, CARGO_TARGET_DIR: path.join(dir, "target") };
  const call = (args) => spawnSync(runner, args, { env, encoding: "utf8" });
  assert.equal(call(["run", "--color", "always", "--", "--x"]).status, 0);
  assert.equal(call(["build", "--release"]).status, 0);
  assert.equal(call(["check"]).status, 3);
  const expected = process.platform === "darwin"
    ? ["build --color always", "run --color always -- --x", "build --release", "check"]
    : ["run --color always -- --x", "build --release", "check"];
  assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), expected);
});
