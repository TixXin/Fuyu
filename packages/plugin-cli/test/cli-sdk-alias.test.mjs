import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { check, dev, VERSION } from "../src/index.mjs";
import { copyFixture, editJson, writeFiles } from "./helpers.mjs";

test("host and window code resolve fuyu-plugin/services while bare fuyu-plugin runtime imports stay blocked in windows", async () => {
  assert.equal(VERSION, JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/host.ts": 'import type { Context } from "fuyu-plugin";\nimport { timersV1 } from "fuyu-plugin/services";\nexport const inject = ["clients", "timers/v1"];\nexport function apply(ctx: Context) {\n  ctx.services.get(timersV1);\n  ctx.clients.add("island", new URL("./island.js", import.meta.url).href);\n}\n',
      "src/island.tsx": 'import type { Context } from "fuyu-plugin";\nimport { timersV1 } from "fuyu-plugin/services";\nexport default function apply(ctx: Context) {\n  const label = timersV1.name;\n  ctx.slots.add("island.dev/v1", { id: "svc", component: () => <span>{label}</span> });\n}\n',
    });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.inject = { required: ["clients", "timers/v1"] };
    });
  });
  const ok = await check(dir, { allowExperimental: false });
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));

  const badWindow = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/island.tsx": `import { Service } from "fuyu-plugin";\n${readFileSync(join(root, "src/island.tsx"), "utf8")}\nexport const s = Service;\n`,
    });
  });
  const badRes = await check(badWindow);
  assert.equal(badRes.ok, false);
  assert.ok(badRes.errors.some((issue) => /"fuyu-plugin" is provided by the app/.test(issue.message)), JSON.stringify(badRes.errors));
});
