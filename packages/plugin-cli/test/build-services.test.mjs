import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "../src/index.mjs";
import { copyFixture } from "./helpers.mjs";

const read = (dir, path) => readFileSync(join(dir, path), "utf8");

test("host code resolves @fuyu/plugin-services from the CLI's sibling package when node_modules is absent", async () => {
  const dir = copyFixture("hello", (root) => {
    writeFileSync(
      join(root, "src", "host.ts"),
      'import { timersV1 } from "@fuyu/plugin-services";\nexport const service = timersV1.name;\nexport function apply() {}\n',
    );
  });
  const built = await build(dir);
  const hostCode = read(built.outDir, "dist/host.js");
  assert.match(hostCode, /timers\/v1/);
  assert.doesNotMatch(hostCode, /from "@fuyu\/plugin-services"/);
});
