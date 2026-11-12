import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { signingConfigPath, signingDir } from "../../scripts/signing-dir.mjs";

const HOME = join("C:", "Users", "me");
const current = join(HOME, ".tauri", "fuyu");
const legacy = join(HOME, ".tauri", "fly-island");
const only = (...dirs) => (dir) => dirs.includes(dir);

test("signing keys live in ~/.tauri/fuyu, and the folder from before the rename is read while it is the only one", () => {
  assert.equal(signingDir(HOME, only()), current);
  assert.equal(signingDir(HOME, only(current)), current);
  assert.equal(signingDir(HOME, only(legacy)), legacy);
  assert.equal(signingDir(HOME, only(current, legacy)), current);
});

test("the release signing config honours FUYU_SIGNING_CONFIG, then the old FOCUSD_SIGNING_CONFIG", () => {
  assert.equal(signingConfigPath({ FUYU_SIGNING_CONFIG: "new.json", FOCUSD_SIGNING_CONFIG: "old.json" }, HOME, only()), "new.json");
  assert.equal(signingConfigPath({ FOCUSD_SIGNING_CONFIG: "old.json" }, HOME, only()), "old.json");
  assert.equal(signingConfigPath({}, HOME, only(legacy)), join(legacy, "release.json"));
  assert.equal(signingConfigPath({}, HOME, only()), join(current, "release.json"));
});
