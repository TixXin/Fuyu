import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { SHARED_MODULES } from "@fuyu/plugin-base/protocol";

const shimsDir = fileURLToPath(new URL("../src/client/shims/", import.meta.url));
test("SHARED_MODULES names react and react/jsx-runtime", () => {
  assert.deepEqual(Object.keys(SHARED_MODULES).sort(), ["react", "react/jsx-runtime"]);
});

test("every shared module path is a shim file under __shared/", () => {
  const files = readdirSync(shimsDir).sort();
  const paths = Object.values(SHARED_MODULES);
  for (const path of paths) assert.match(path, /^__shared\/[a-z0-9-]+\.js$/);
  assert.deepEqual(paths.map((path) => path.slice("__shared/".length)).sort(), files);
});
