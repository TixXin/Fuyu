import assert from "node:assert/strict";
import { test } from "node:test";
import { compareVersions, isPrerelease, isValidRange, isValidVersion, satisfies } from "../src/index.mjs";

test("versions sort by semver rules, prereleases before the release", () => {
  const sorted = ["1.0.0", "1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-beta", "1.0.0-alpha.beta", "1.0.0-beta.11", "1.0.0-beta.2", "1.0.0-rc.1", "0.9.9", "1.10.0", "1.2.0"].sort(compareVersions);
  assert.deepEqual(sorted, ["0.9.9", "1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "1.2.0", "1.10.0"]);
  assert.equal(compareVersions("1.0.0+build.1", "1.0.0"), 0);
});

test("invalid versions are recognised", () => {
  for (const bad of ["1.0", "01.0.0", "1.0.0-", "1.0.0-01", "a.b.c", "", null]) assert.equal(isValidVersion(bad), false, String(bad));
  assert.equal(isValidVersion("v1.2.3"), true);
  assert.equal(isPrerelease("1.0.0-beta.1"), true);
  assert.equal(isPrerelease("1.0.0"), false);
  assert.throws(() => compareVersions("1.0", "1.0.0"));
});

const cases = [
  [">=0.4.0", "0.4.0", true],
  [">=0.4.0", "0.3.9", false],
  ["^1.2.3", "1.9.0", true],
  ["^1.2.3", "2.0.0", false],
  ["^1.2.3", "2.0.0-beta.1", false],
  ["^0.2.3", "0.2.9", true],
  ["^0.2.3", "0.3.0", false],
  ["^0.0.3", "0.0.4", false],
  ["~1.2.3", "1.2.9", true],
  ["~1.2.3", "1.3.0", false],
  ["~1", "1.9.9", true],
  ["1.x", "1.4.0", true],
  ["1.x", "2.0.0", false],
  ["1.2", "1.2.7", true],
  ["*", "9.9.9", true],
  ["", "0.0.1", true],
  [">1.2", "1.2.9", false],
  [">1.2", "1.3.0", true],
  ["<=1.2", "1.2.9", true],
  ["<=1.2", "1.3.0-beta", false],
  ["<1.2", "1.1.9", true],
  ["<1.2", "1.2.0-beta", false],
  [">=0.4.0 <0.6.0", "0.5.5", true],
  [">=0.4.0 <0.6.0", "0.6.0", false],
  [">= 0.4.0", "0.4.1", true],
  ["0.3.x || >=0.5.0", "0.4.0", false],
  ["0.3.x || >=0.5.0", "0.3.2", true],
  ["1.0.0 - 1.2", "1.2.9", true],
  ["1.0.0 - 1.2", "1.3.0", false],
  [">=0.5.0", "0.5.0-beta.1", false],
  [">=0.5.0-beta.1", "0.5.0-beta.2", true],
];

for (const [range, version, expected] of cases) {
  test(`${version} ${expected ? "satisfies" : "does not satisfy"} "${range}"`, () => {
    assert.equal(satisfies(version, range), expected);
  });
}

test("bad ranges are not valid and satisfy nothing", () => {
  for (const bad of [">=abc", "1.2.3.4", "^", "x.1", null]) {
    assert.equal(isValidRange(bad), false, String(bad));
    assert.equal(satisfies("1.0.0", bad), false);
  }
});

test("a prerelease only matches a range that names a prerelease, unless the caller includes them", () => {
  assert.equal(satisfies("0.3.11-beta.4", ">=0.3.10"), false);
  assert.equal(satisfies("0.3.11-beta.4", ">=0.3.10", { includePrerelease: true }), true);
  assert.equal(satisfies("0.4.0-beta.1", "^0.3.10", { includePrerelease: true }), false);
});
