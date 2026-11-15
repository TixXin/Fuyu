import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeRevoked, selectVersions } from "../src/index.mjs";
import { DAY, NOW, daysAgo, iso, makeKey, plugin, reason, revoked, version } from "./fixtures.mjs";

const author = makeKey();
const name = "@someone/weather";
const v = (ver, options = {}) => version(name, author, { v: ver, ...options });
const pick = (versions, options = {}) =>
  selectVersions(plugin({ author, versions }), { fuyuVersion: "0.5.0", platform: "windows", now: NOW, ...options });
const ver = (choice) => choice?.entry.version ?? null;

test("auto-update only takes versions past the 3-day cooldown", () => {
  const result = pick([v("1.0.0"), v("1.1.0", { published: daysAgo(4) }), v("1.2.0", { published: daysAgo(1) })], { installed: "1.0.0" });
  assert.equal(ver(result.autoUpdate), "1.1.0");
  assert.equal(ver(result.manual), "1.2.0");
  assert.equal(result.manual.cooled, false);
});

test("the cooldown ends exactly 3 days after publishedAt", () => {
  const edge = [v("1.0.0"), v("1.1.0", { published: iso(NOW - 3 * DAY) })];
  assert.equal(ver(pick(edge, { installed: "1.0.0" }).autoUpdate), "1.1.0");
  const just = [v("1.0.0"), v("1.1.0", { published: iso(NOW - 3 * DAY + 1) })];
  assert.equal(pick(just, { installed: "1.0.0" }).autoUpdate, null);
});

test("an urgent version skips the cooldown", () => {
  const result = pick([v("1.0.0"), v("1.0.1", { published: daysAgo(0.1), urgent: true })], { installed: "1.0.0" });
  assert.equal(ver(result.autoUpdate), "1.0.1");
  assert.equal(result.autoUpdate.urgent, true);
});

test("nothing to auto-update when installed is newest, or nothing is installed", () => {
  const versions = [v("1.0.0"), v("1.1.0")];
  assert.equal(pick(versions, { installed: "1.1.0" }).autoUpdate, null);
  assert.equal(pick(versions, { installed: "1.1.0" }).manual, null);
  assert.equal(pick(versions).autoUpdate, null);
});

test("a new install takes the newest version past the cooldown", () => {
  const result = pick([v("1.0.0"), v("1.1.0", { published: daysAgo(5) }), v("1.2.0", { published: daysAgo(1) })]);
  assert.equal(ver(result.install), "1.1.0");
  assert.equal(result.install.fresh, false);
  assert.equal(ver(result.manual), "1.2.0");
});

test("with only fresh versions a new install takes the newest and marks it just published", () => {
  const result = pick([v("1.0.0", { published: daysAgo(2) }), v("1.1.0", { published: daysAgo(1) })]);
  assert.equal(ver(result.install), "1.1.0");
  assert.equal(result.install.fresh, true);
});

test("an older island gets the newest version it can run", () => {
  const versions = [v("1.0.0", { engines: ">=0.3.0" }), v("1.1.0", { engines: ">=0.4.0" }), v("2.0.0", { engines: ">=0.6.0" })];
  const result = pick(versions, { fuyuVersion: "0.4.2", installed: "1.0.0" });
  assert.equal(ver(result.autoUpdate), "1.1.0");
  assert.equal(ver(result.manual), "1.1.0");
  assert.equal(ver(result.install), "1.1.0");
  assert.deepEqual(result.skipped, [{ version: "2.0.0", reason: "engines" }]);
});

test("versions for another platform are skipped", () => {
  const result = pick([v("1.0.0"), v("1.1.0", { platforms: ["macos"] })]);
  assert.equal(ver(result.install), "1.0.0");
  assert.deepEqual(result.skipped, [{ version: "1.1.0", reason: "platform" }]);
});

test("prereleases are skipped unless asked for", () => {
  const versions = [v("1.0.0"), v("1.1.0-beta.1")];
  assert.equal(ver(pick(versions).manual), "1.0.0");
  assert.equal(ver(pick(versions, { prerelease: true }).manual), "1.1.0-beta.1");
});

test("disabled versions are never picked; warned ones only by hand", () => {
  const list = revoked([
    { id: "r1", name, version: "1.2.0", level: "disable", reason: reason("坏", "bad") },
    { id: "r2", name, version: "1.1.0", level: "warn", reason: reason("慢", "slow") },
  ]);
  const { state } = mergeRevoked(null, list);
  const result = pick([v("1.0.0"), v("1.1.0"), v("1.2.0")], { installed: "1.0.0", revocations: state });
  assert.equal(ver(result.manual), "1.1.0");
  assert.equal(result.manual.warned, true);
  assert.equal(result.autoUpdate, null);
  assert.equal(ver(result.install), "1.0.0");
  assert.deepEqual(result.skipped, [{ version: "1.2.0", reason: "revoked" }]);
});

test("versions sort by semver, not by list order", () => {
  const result = pick([v("1.10.0"), v("1.9.0"), v("1.2.0")]);
  assert.equal(ver(result.install), "1.10.0");
});
