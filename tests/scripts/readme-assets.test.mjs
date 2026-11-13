import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readmeAssets } from "../../scripts/readme/assets.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "assets", "readme");

test("the README's SVGs are what pnpm readme:assets writes", () => {
  for (const [file, svg] of Object.entries(readmeAssets())) {
    assert.equal(readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n"), svg, `${file} was edited by hand or is stale; run pnpm readme:assets`);
  }
});
