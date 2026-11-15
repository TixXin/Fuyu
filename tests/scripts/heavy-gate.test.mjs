import assert from "node:assert/strict";
import { test } from "node:test";
import { expandVars, heavyGate } from "../../scripts/heavy/gate.mjs";

const env = {};

test("light commands pass", () => {
  for (const command of ["git status", "pnpm check", "cargo fmt", "cargo metadata --format-version 1", "pnpm build:exe", "pnpm test:regression settings", "pnpm verify"]) {
    assert.equal(heavyGate(command, env), null, command);
  }
});

test("raw cargo builds and tauri build are sent to the queue", () => {
  for (const command of ["cargo test --manifest-path src-tauri/Cargo.toml", "cd src-tauri && cargo build --release", "pnpm tauri build --bundles app", "cargo +1.99.1 clippy --all-targets"]) {
    assert.match(heavyGate(command, env), /pnpm heavy --/, command);
  }
});

test("queued commands pass", () => {
  assert.equal(heavyGate("pnpm heavy -- cargo test --manifest-path src-tauri/Cargo.toml > /tmp/x/log.txt 2>&1", env), null);
  assert.equal(heavyGate("node scripts/heavy/heavy.mjs --label t -- cargo test", env), null);
});

test("a private target dir is refused even when queued", () => {
  assert.match(heavyGate("CARGO_TARGET_DIR=src-tauri/target/agents-d58 pnpm heavy -- cargo test", env), /agents-d58/);
  assert.equal(heavyGate("CARGO_TARGET_DIR=/Users/a/Fuyu/src-tauri/target/agents pnpm heavy -- cargo test", env), null);
});

test("building inside a copy of the repo in a temp dir is refused", () => {
  assert.match(heavyGate("cd /private/tmp/claude-501/x/scratchpad/tree && pnpm heavy -- cargo test", env), /仓库副本/);
  assert.match(heavyGate("S=/private/tmp/claude-501/p/s/scratchpad/upd; cd $S/src; pnpm heavy -- cargo test", env), /仓库副本/);
  assert.match(heavyGate("pnpm heavy -- cargo test --manifest-path /tmp/copy/src-tauri/Cargo.toml", env), /仓库副本/);
});

test("the gate can be switched off", () => {
  assert.equal(heavyGate("cargo test", { FUYU_HEAVY_GATE: "off" }), null);
});

test("variables set in the same command are expanded", () => {
  assert.equal(expandVars("S=/tmp/a; cd $S/src && ls ${S}"), "S=/tmp/a; cd /tmp/a/src && ls /tmp/a");
});
