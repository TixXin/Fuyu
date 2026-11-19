import assert from "node:assert/strict";
import { test } from "node:test";
import { validateIndex } from "../src/index.mjs";
import { index, makeKey, plugin } from "./fixtures.mjs";

const author = makeKey();
const plugins = () => ["@someone/weather", "@someone/clock", "@someone/notes"].map((name) => plugin({ name, author }));
const bundle = (over = {}) => ({
  id: "daily",
  displayName: { "zh-CN": "每日", en: "Daily" },
  description: { "zh-CN": "天气、时钟和笔记", en: "Weather, clock and notes" },
  plugins: ["@someone/weather", "@someone/clock"],
  ...over,
});
const paths = (bundles) => validateIndex({ ...index(plugins()), bundles }).map((problem) => problem.path);

test("an index with well-formed bundles has no problems", () => {
  assert.deepEqual(paths([bundle(), bundle({ id: "all-3", plugins: ["@someone/weather", "@someone/clock", "@someone/notes"], onboarding: true })]), []);
  assert.deepEqual(paths([]), []);
});

test("a field this version does not know is ignored, so a later field cannot break an older island", () => {
  assert.deepEqual(validateIndex({ ...index(plugins()), somethingLater: [{ any: "shape" }] }), []);
  assert.deepEqual(paths([bundle({ somethingLater: 1 })]), []);
});

test("each bundle field is checked", () => {
  assert.deepEqual(paths("daily"), ["bundles"]);
  assert.deepEqual(paths([null]), ["bundles[0]"]);
  assert.deepEqual(paths([bundle({ id: "Daily Pack", displayName: { en: "Daily" }, description: "text", onboarding: "yes" })]), [
    "bundles[0].id",
    "bundles[0].displayName",
    "bundles[0].description",
    "bundles[0].onboarding",
  ]);
});

test("a bundle lists two to six plugins of this index, each once", () => {
  assert.deepEqual(paths([bundle({ plugins: ["@someone/weather"] })]), ["bundles[0].plugins"]);
  assert.deepEqual(paths([bundle({ plugins: new Array(7).fill("@someone/weather") })]), ["bundles[0].plugins"]);
  assert.deepEqual(paths([bundle({ plugins: ["@someone/weather", "Clock"] })]), ["bundles[0].plugins[1]"]);
  assert.deepEqual(paths([bundle({ plugins: ["@someone/weather", "@someone/gone"] })]), ["bundles[0].plugins[1]"]);
  assert.deepEqual(paths([bundle({ plugins: ["@someone/weather", "@someone/clock", "@someone/weather"] })]), ["bundles[0].plugins[2]"]);
});

test("bundle ids are unique", () => {
  assert.deepEqual(paths([bundle(), bundle()]), ["bundles[1]"]);
});
