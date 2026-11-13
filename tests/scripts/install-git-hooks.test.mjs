import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { hooksPathAction, installGitHooks } from "../../scripts/install-git-hooks.mjs";

function cleanEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
}

test("an unset hooksPath is set, ours is kept, someone else's is left alone", () => {
  assert.equal(hooksPathAction(""), "set");
  assert.equal(hooksPathAction(undefined), "set");
  assert.equal(hooksPathAction(".githooks\n"), "keep");
  assert.equal(hooksPathAction("E:\\Projects\\fuyu\\.githooks"), "keep");
  assert.equal(hooksPathAction("/home/me/fuyu/.githooks/"), "keep");
  assert.equal(hooksPathAction(".husky"), "foreign");
});

test("installGitHooks sets core.hooksPath in a fresh repo and skips outside one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fuyu-git-hooks-"));
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (key.startsWith("GIT_")) delete process.env[key];
    assert.equal(installGitHooks(dir), "skip");
    execFileSync("git", ["init", "-q"], { cwd: dir, env: cleanEnv() });
    assert.equal(installGitHooks(dir), "set");
    const value = execFileSync("git", ["config", "--local", "core.hooksPath"], { cwd: dir, env: cleanEnv(), encoding: "utf8" });
    assert.equal(value.trim(), ".githooks");
    assert.equal(installGitHooks(dir), "keep");
  } finally {
    Object.assign(process.env, saved);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
