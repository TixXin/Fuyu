import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { dispatchedRun, SMOKE_WORKFLOW } from "../../scripts/release/smoke-test.mjs";

test("the smoke test's run is the newest dispatch made after starting it", () => {
  const since = Date.parse("2026-11-12T10:00:00Z");
  const runs = [
    { databaseId: 1, event: "workflow_dispatch", createdAt: "2026-11-12T09:00:00Z" },
    { databaseId: 2, event: "workflow_dispatch", createdAt: "2026-11-12T10:00:03Z" },
    { databaseId: 3, event: "push", createdAt: "2026-11-12T10:00:04Z" },
  ];
  assert.equal(dispatchedRun(runs, since).databaseId, 2);
  assert.equal(dispatchedRun(runs.slice(0, 1), since), null);
});

test("the workflow the release starts exists and runs the PowerShell check", () => {
  const workflow = new URL(`../../.github/workflows/${SMOKE_WORKFLOW}`, import.meta.url);
  assert.ok(existsSync(workflow));
  assert.match(readFileSync(workflow, "utf8"), /scripts\/release\/smoke-test\.ps1/);
  assert.ok(existsSync(new URL("../../scripts/release/smoke-test.ps1", import.meta.url)));
});
