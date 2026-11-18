import assert from "node:assert/strict";
import { test } from "node:test";
import { compareVersions, isValidRange, isValidVersion, satisfies } from "@fuyu/plugin-manifest";

test("versions are strict semver", () => {
  for (const good of ["0.0.1", "1.2.3", "1.2.3-beta.1", "1.2.3+build.5"]) assert.equal(isValidVersion(good), true, good);
  for (const bad of ["1.2", "01.2.3", "1.2.3.4", "latest", "", null]) assert.equal(isValidVersion(bad), false, String(bad));
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0-alpha.2", "1.0.0-alpha.10"), -1);
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-alpha.1"), -1);
  assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
});

test("ranges follow npm's semantics", () => {
  const cases = [
    ["1.2.3", "^1.0.0", true], ["2.0.0", "^1.0.0", false], ["0.2.5", "^0.2.3", true], ["0.3.0", "^0.2.3", false],
    ["0.0.3", "^0.0.3", true], ["0.0.4", "^0.0.3", false], ["1.2.9", "~1.2.3", true], ["1.3.0", "~1.2.3", false],
    ["0.4.1", ">=0.4.0", true], ["0.3.9", ">=0.4.0", false], ["1.5.0", "1.x", true], ["2.0.0", "1.x", false],
    ["5.0.0", "*", true], ["1.5.0", "1.0.0 - 1.9", true], ["2.0.0", "1.0.0 - 1.9", false], ["3.0.0", "^1 || ^3", true],
    ["1.2.0", ">= 1.0 < 2", true], ["1.3.0", ">1.2", true], ["1.2.9", ">1.2", false], ["1.2.9", "<=1.2", true],
  ];
  for (const [version, range, expected] of cases) assert.equal(satisfies(version, range), expected, `${version} ${range}`);
});

test("prereleases only match ranges that name a prerelease of the same version", () => {
  assert.equal(satisfies("1.0.0-beta.2", ">=1.0.0-beta.1"), true);
  assert.equal(satisfies("1.1.0-beta", ">=1.0.0"), false);
  assert.equal(satisfies("0.4.0-beta.1", ">=0.4.0-beta.0 <0.5"), true);
  assert.equal(satisfies("0.5.0-beta.1", ">=0.4.0-beta.0 <0.6"), false);
});

test("a caller can let a prerelease take part in a range by ordering", () => {
  const app = (version, range) => satisfies(version, range, { includePrerelease: true });
  assert.equal(app("0.3.11-beta.4", ">=0.3.10"), true);
  assert.equal(app("0.3.11-beta.4", "^0.3.10"), true);
  assert.equal(app("0.3.11-beta.4", "*"), true);
  assert.equal(app("0.3.11-beta.4", ">=0.3.11"), false);
  assert.equal(app("0.3.10-beta.1", ">=0.3.10"), false);
  assert.equal(app("0.4.0-beta.1", "^0.3.10"), false);
  assert.equal(satisfies("0.3.11-beta.4", ">=0.3.10"), false);
});

test("bad ranges are rejected", () => {
  for (const bad of ["", "abc", ">=1.x.2", "1.2.3.4", "^", "latest", null]) assert.equal(isValidRange(bad), false, String(bad));
  assert.equal(satisfies("1.0.0", "nonsense"), false);
});
