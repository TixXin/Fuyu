import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LIGHT_AUDIT, pageName, unexpected } from "../../scripts/regression-contrast.mjs";

test("a page's allowlisted elements are dropped from the light pass", () => {
  const findings = [{ key: "span.a", ratio: 2 }, { key: "kbd", ratio: 2.9 }];
  assert.deepEqual(unexpected(findings, { "list-pages.html": ["kbd"] }, "list-pages.html?test=1"), [{ key: "span.a", ratio: 2 }]);
  assert.deepEqual(unexpected(findings, {}, "list-pages.html"), findings);
  assert.equal(pageName("todo-island.html?test=1"), "todo-island.html");
});

test("the audit is a script the browser can parse", () => {
  assert.doesNotThrow(() => new Function(`return ${LIGHT_AUDIT}`));
});

test("the allowlist names only regression pages", () => {
  const { pages } = JSON.parse(readFileSync(new URL("../regression/contrast-allowlist.json", import.meta.url), "utf8"));
  for (const page of Object.keys(pages)) assert.match(page, /^[a-z-]+\.html$/);
});
