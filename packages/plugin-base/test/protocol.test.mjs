import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { SHARED_MODULES } from "@fuyu/plugin-base/protocol";

const shimsDir = fileURLToPath(new URL("../src/client/shims/", import.meta.url));
const rustTable = fileURLToPath(new URL("../../../src-tauri/src/plugin_kernel/protocol.rs", import.meta.url));

function servedByRust() {
  const source = readFileSync(rustTable, "utf8");
  return [...source.matchAll(/\("([^"]+)",\s*include_str!\("[^"]*\/client\/shims\/([^"]+)"\)\)/g)].map(([, path, file]) => ({ path, file }));
}

test("SHARED_MODULES names react and react/jsx-runtime", () => {
  assert.deepEqual(Object.keys(SHARED_MODULES).sort(), ["react", "react/jsx-runtime"]);
});

test("every shared module path is a shim file under __shared/", () => {
  const files = readdirSync(shimsDir).sort();
  const paths = Object.values(SHARED_MODULES);
  for (const path of paths) assert.match(path, /^__shared\/[a-z0-9-]+\.js$/);
  assert.deepEqual(paths.map((path) => path.slice("__shared/".length)).sort(), files);
});

test("the app serves exactly the shared module paths, each from the shim of the same name", () => {
  const served = servedByRust();
  assert.ok(served.length > 0, `no shim table found in ${rustTable}`);
  for (const { path, file } of served) assert.equal(path, `__shared/${file}`);
  assert.deepEqual(served.map(({ path }) => path).sort(), Object.values(SHARED_MODULES).sort());
});
