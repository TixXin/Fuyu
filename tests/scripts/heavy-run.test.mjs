import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { run } from "../../scripts/heavy/heavy.mjs";

const exitWith = (code) => ["--", "node", "-e", `process.exit(${code})`];

test("the build cache is pruned after every queued job, also when the job fails", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "heavy-run-"));
  const saved = { dir: process.env.FUYU_HEAVY_DIR, slots: process.env.FUYU_HEAVY_SLOTS };
  process.env.FUYU_HEAVY_DIR = dir;
  process.env.FUYU_HEAVY_SLOTS = "1";
  try {
    let pruned = 0;
    const env = { ...process.env, FUYU_HEAVY: "" };
    assert.equal(run(exitWith(3), env, { afterJob: () => { pruned += 1; } }), 3);
    assert.equal(run(exitWith(0), env, { afterJob: () => { pruned += 1; } }), 0);
    assert.equal(pruned, 2);
  } finally {
    for (const [key, value] of [["FUYU_HEAVY_DIR", saved.dir], ["FUYU_HEAVY_SLOTS", saved.slots]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a job nested inside another queued job leaves pruning to the outer one", () => {
  let pruned = 0;
  assert.equal(run(exitWith(0), { ...process.env, FUYU_HEAVY: "1" }, { afterJob: () => { pruned += 1; } }), 0);
  assert.equal(pruned, 0);
});

test("cargo build commands without a target dir default to src-tauri/target/agents", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "heavy-run-"));
  const baseEnv = { FUYU_HEAVY_DIR: dir, FUYU_HEAVY_SLOTS: "1", FUYU_HEAVY: "" };
  try {
    for (const sub of ["build", "test", "check", "clippy", "run"]) {
      let spawnedEnv = null;
      const logs = [];
      const code = run(["--", "cargo", sub, "--manifest-path", "src-tauri/Cargo.toml"], baseEnv, {
        afterJob: () => {},
        log: (line) => logs.push(line),
        spawn: (_cmd, _args, options) => {
          spawnedEnv = options.env;
          return { status: 0 };
        },
      });
      assert.equal(code, 0);
      assert.equal(spawnedEnv?.CARGO_TARGET_DIR, "src-tauri/target/agents");
      assert.equal(logs.some((line) => line.includes("src-tauri/target/agents")), true);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cargo commands that already specify a target dir keep it unchanged", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "heavy-run-"));
  const baseEnv = { FUYU_HEAVY_DIR: dir, FUYU_HEAVY_SLOTS: "1", FUYU_HEAVY: "" };
  try {
    let envFromVar = null;
    const logsFromVar = [];
    run(["--", "cargo", "test"], { ...baseEnv, CARGO_TARGET_DIR: "src-tauri/target/release" }, {
      afterJob: () => {},
      log: (line) => logsFromVar.push(line),
      spawn: (_cmd, _args, options) => {
        envFromVar = options.env;
        return { status: 0 };
      },
    });
    assert.equal(envFromVar?.CARGO_TARGET_DIR, "src-tauri/target/release");
    assert.equal(logsFromVar.length, 0);

    let envFromFlag = null;
    const logsFromFlag = [];
    run(["--", "cargo", "test", "--target-dir", "src-tauri/target/release"], baseEnv, {
      afterJob: () => {},
      log: (line) => logsFromFlag.push(line),
      spawn: (_cmd, _args, options) => {
        envFromFlag = options.env;
        return { status: 0 };
      },
    });
    assert.equal(envFromFlag?.CARGO_TARGET_DIR, undefined);
    assert.equal(logsFromFlag.length, 0);

    let envFromEqFlag = null;
    run(["--", "cargo", "+1.99.1", "clippy", "--target-dir=src-tauri/target/release"], baseEnv, {
      afterJob: () => {},
      log: () => {},
      spawn: (_cmd, _args, options) => {
        envFromEqFlag = options.env;
        return { status: 0 };
      },
    });
    assert.equal(envFromEqFlag?.CARGO_TARGET_DIR, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tauri build does not get the default agents target dir", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "heavy-run-"));
  const baseEnv = { FUYU_HEAVY_DIR: dir, FUYU_HEAVY_SLOTS: "1", FUYU_HEAVY: "" };
  try {
    for (const cmd of [["--", "tauri", "build"], ["--", "pnpm", "tauri", "build"]]) {
      let spawnedEnv = null;
      const logs = [];
      run(cmd, baseEnv, {
        afterJob: () => {},
        log: (line) => logs.push(line),
        spawn: (_cmd, _args, options) => {
          spawnedEnv = options.env;
          return { status: 0 };
        },
      });
      assert.equal(spawnedEnv?.CARGO_TARGET_DIR, undefined);
      assert.equal(logs.length, 0);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
