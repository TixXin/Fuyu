import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { defaultConfigPath, islandHome } from "../src/dev.mjs";

const drive = (letter, ...parts) => (process.platform === "win32" ? path.join(`${letter}:`, ...parts) : path.join("/", letter, ...parts));
const profile = drive("C", "Users", "me");
const appData = path.join(profile, "AppData", "Roaming");
const noPointer = () => {
  throw new Error("missing");
};

test("the island's home: FUYU_HOME, then the pointer file, then ~/.fuyu", () => {
  const pointer = () => JSON.stringify({ home: drive("D", "Sync", "fuyu") });
  assert.equal(islandHome({ FUYU_HOME: drive("E", "fuyu"), APPDATA: appData }, profile, pointer), drive("E", "fuyu"));
  assert.equal(islandHome({ APPDATA: appData }, profile, pointer), drive("D", "Sync", "fuyu"));
  assert.equal(islandHome({ APPDATA: appData }, profile, noPointer), path.join(profile, ".fuyu"));
  assert.equal(islandHome({ FUYU_HOME: "relative", APPDATA: appData }, profile, () => "{"), path.join(profile, ".fuyu"));
});

test("local-api.json is looked for in the home first, then where older islands wrote it", () => {
  const env = { APPDATA: appData, FUYU_HOME: drive("E", "fuyu") };
  const home = drive("E", "fuyu", "local-api.json");
  const old = path.join(appData, "com.tixxin.fuyu", "local-api.json");
  assert.equal(defaultConfigPath(env, (file) => file === home || file === old), home);
  assert.equal(defaultConfigPath(env, (file) => file === old), old);
  assert.equal(defaultConfigPath(env, () => false), home);
});
