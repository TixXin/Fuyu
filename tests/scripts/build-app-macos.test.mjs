import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { APP_NAME, installApp } from "../../scripts/build-app-macos.mjs";

function bundle(dir, text) {
  const binary = path.join(dir, APP_NAME, "Contents", "MacOS");
  mkdirSync(binary, { recursive: true });
  writeFileSync(path.join(binary, "fuyu"), text);
  return path.join(dir, APP_NAME);
}

test("the built app replaces the one in Applications and leaves nothing beside it", () => {
  const root = mkdtempSync(path.join(tmpdir(), "build-app-"));
  try {
    const applications = path.join(root, "Applications");
    const first = installApp(bundle(path.join(root, "one"), "1"), applications);
    assert.equal(readFileSync(path.join(first, "Contents", "MacOS", "fuyu"), "utf8"), "1");
    const second = installApp(bundle(path.join(root, "two"), "2"), applications);
    assert.equal(second, first);
    assert.equal(readFileSync(path.join(second, "Contents", "MacOS", "fuyu"), "utf8"), "2");
    assert.deepEqual(readdirSync(applications), [APP_NAME]);
    assert.ok(existsSync(path.join(root, "two", APP_NAME)), "the build output stays where it was");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
