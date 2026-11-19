import assert from "node:assert/strict";
import { test } from "node:test";
import { bundleSummary, outsidePublishers, visibleBundles, withInstalled } from "../../src/windows/settings/pluginBundles.ts";

const text = (zh, en) => ({ "zh-CN": zh, en });
const member = (name, state, reason) => (reason ? { name, state, reason } : { name, state });
const bundle = (id, members, names = ["套装", "Bundle"]) => ({ id, displayName: text(...names), description: text("一起装", "Installed together"), onboarding: false, members });
const plugin = (name, official) => ({ name, official, publisher: { github: official ? "TixXin" : name.split("/")[0].slice(1), official } });

test("a bundle offers everything, the rest, or what this computer can run, and is done when nothing is left", () => {
  const action = (...states) => bundleSummary(bundle("b", states.map((state, index) => member(`@a/p${index}`, state)))).action;
  assert.equal(action("available", "available"), "install-all");
  assert.equal(action("available", "installed"), "install-rest");
  assert.equal(action("available", "disabled", "unavailable"), "install-rest");
  assert.equal(action("available", "available", "unavailable"), "install-usable");
  assert.equal(action("installed", "disabled"), "done");
  assert.equal(action("installed", "installed", "unavailable"), "done");
});

test("the counts tell installed, missing and unusable members apart; a disabled plugin counts as one you have", () => {
  const summary = bundleSummary(bundle("b", [member("@a/one", "available"), member("@a/two", "installed"), member("@a/three", "disabled"), member("@a/four", "unavailable", "platform")]));
  assert.deepEqual(summary, { total: 4, owned: 2, available: 1, unavailable: 1, action: "install-rest" });
});

test("members just installed are shown as installed; others keep their state", () => {
  const before = bundle("b", [member("@a/one", "available"), member("@a/two", "available"), member("@a/three", "unavailable", "engines")]);
  const after = withInstalled(before, ["@a/one", "@a/three"]);
  assert.deepEqual(after.members, [member("@a/one", "installed"), member("@a/two", "available"), member("@a/three", "unavailable", "engines")]);
  assert.equal(withInstalled(before, []), before);
});

test("bundles show when browsing everything, hide under a category, and a search matches their name or description in any language", () => {
  const list = [bundle("focus", [], ["专注套装", "Deep focus"]), bundle("news", [], ["资讯", "Stay informed"])];
  assert.deepEqual(visibleBundles(list, "", null).map((item) => item.id), ["focus", "news"]);
  assert.deepEqual(visibleBundles(list, "  ", "productivity"), []);
  assert.deepEqual(visibleBundles(list, "DEEP", null).map((item) => item.id), ["focus"]);
  assert.deepEqual(visibleBundles(list, "资讯", "productivity").map((item) => item.id), ["news"]);
  assert.deepEqual(visibleBundles(list, "一起装", null).map((item) => item.id), ["focus", "news"]);
  assert.deepEqual(visibleBundles(list, "weather", null), []);
});

test("only publishers of plugins about to be installed from outside the Fuyu team are named, each once", () => {
  const plugins = [plugin("@fuyu/rss", true), plugin("@nori/sounds", false), plugin("@nori/more", false), plugin("@ryo/clip", false), plugin("@lin/stats", false)];
  const subject = bundle("b", [member("@fuyu/rss", "available"), member("@nori/sounds", "available"), member("@nori/more", "available"), member("@ryo/clip", "available"), member("@lin/stats", "installed"), member("@gone/missing", "available")]);
  assert.deepEqual(outsidePublishers(subject, plugins), ["nori", "ryo"]);
});
