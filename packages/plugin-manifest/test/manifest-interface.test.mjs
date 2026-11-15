import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_APP_KEY, validateManifest } from "@fuyu/plugin-manifest";

const minimal = (appKey = "fuyu") => ({
  name: "@someone/weather",
  version: "1.0.0",
  type: "module",
  license: "MIT",
  repository: "github:someone/weather",
  engines: { [appKey]: ">=0.4.0" },
  [appKey]: {
    manifest: 1,
    displayName: { "zh-CN": "天气", en: "Weather" },
    description: { "zh-CN": "看天气", en: "See the weather" },
    icon: "assets/icon.png",
    categories: ["information"],
  },
});

test("validateManifest returns the manifest and its app section when it is valid", () => {
  const pkg = minimal();
  const result = validateManifest(pkg);
  assert.equal(DEFAULT_APP_KEY, "fuyu");
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest, pkg);
  assert.equal(result.app, pkg.fuyu);
});

test("validateManifest reads the app section under a configured key", () => {
  assert.equal(validateManifest(minimal("atoll"), { appKey: "atoll" }).ok, true);
  const result = validateManifest(minimal("atoll"));
  assert.equal(result.ok, false);
  assert.equal(result.manifest, null);
  assert.ok(result.errors.some((issue) => issue.path === "fuyu"));
});

test("validateManifest rejects what is not an object", () => {
  for (const value of [null, [], "x", 1]) assert.equal(validateManifest(value).ok, false);
});
