import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { defaultConfigPath, islandHome } from "../src/dev.mjs";

const profile = path.join("C:", "Users", "me");
const appData = path.join(profile, "AppData", "Roaming");
const noPointer = () => {
  throw new Error("missing");
};

test("the island's home: FUYU_HOME, then the pointer file, then ~/.fuyu", () => {
  const pointer = () => JSON.stringify({ home: path.join("D:", "Sync", "fuyu") });
  assert.equal(islandHome({ FUYU_HOME: path.join("E:", "fuyu"), APPDATA: appData }, profile, pointer), path.join("E:", "fuyu"));
  assert.equal(islandHome({ APPDATA: appData }, profile, pointer), path.join("D:", "Sync", "fuyu"));
  assert.equal(islandHome({ APPDATA: appData }, profile, noPointer), path.join(profile, ".fuyu"));
  assert.equal(islandHome({ FUYU_HOME: "relative", APPDATA: appData }, profile, () => "{"), path.join(profile, ".fuyu"));
});

test("local-api.json is looked for in the home first, then where older islands wrote it", () => {
  const env = { APPDATA: appData, FUYU_HOME: path.join("E:", "fuyu") };
  const home = path.join("E:", "fuyu", "local-api.json");
  const old = path.join(appData, "com.tixxin.fuyu", "local-api.json");
  assert.equal(defaultConfigPath(env, (file) => file === home || file === old), home);
  assert.equal(defaultConfigPath(env, (file) => file === old), old);
  assert.equal(defaultConfigPath(env, () => false), home);
});
