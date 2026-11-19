import assert from "node:assert/strict";
import { test } from "node:test";
import { satisfies as manifestSatisfies } from "../../plugin-manifest/src/index.mjs";
import { satisfies as marketSatisfies } from "../src/index.mjs";

const versions = [
  "0.3.9", "0.3.10-beta.1", "0.3.10", "0.3.11-beta.4", "0.3.11", "0.4.0-beta.1", "0.4.0",
  "1.2.3", "1.2.3-beta.2", "1.3.0-beta", "2.0.0-beta.1",
];
const ranges = [
  ">=0.3.10", "^0.3.10", "~0.3.10", ">=0.3.10 <0.4.0", "0.3.x", "*", ">=0.3.11", ">=0.5.0-beta.1",
  "1.0.0 - 1.2", "^1.2.3", ">1.2", "<=1.2", "<1.2", "1.2", "0.3.x || >=0.5.0", "~1", ">=0.4.0 <0.6.0",
];

for (const options of [undefined, { includePrerelease: true }]) {
  test(`the manifest and market ranges agree${options ? " when prereleases are included" : ""}`, () => {
    for (const version of versions) {
      for (const range of ranges) {
        assert.equal(
          manifestSatisfies(version, range, options),
          marketSatisfies(version, range, options),
          `${version} in "${range}"`,
        );
      }
    }
  });
}
