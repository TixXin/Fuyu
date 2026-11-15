import assert from "node:assert/strict";
import { test } from "node:test";
import { diffLockfiles, parsePackageLock, parsePnpmLock } from "../src/index.mjs";

const PNPM_V9 = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      kleur:
        specifier: ^4.1.0
        version: 4.1.5

packages:

  '@scope/tool@2.0.0':
    resolution: {integrity: sha512-old}

  kleur@4.1.5:
    resolution: {integrity: sha512-kleur}
    engines: {node: '>=6'}

  esbuild@0.25.0:
    resolution: {integrity: sha512-esb}
    hasBin: true
    requiresBuild: true

snapshots:

  kleur@4.1.5: {}
`;

const PNPM_V5 = `lockfileVersion: 5.4

packages:

  /kleur/4.1.5:
    resolution: {integrity: sha512-kleur}
    dev: false

  /@scope/tool/2.0.0_react@18.2.0:
    resolution: {integrity: sha512-old}
`;

test("pnpm lockfiles from v5 to v9 give name, version and integrity", () => {
  const v9 = parsePnpmLock(PNPM_V9);
  assert.deepEqual([...v9.keys()].sort(), ["@scope/tool@2.0.0", "esbuild@0.25.0", "kleur@4.1.5"]);
  assert.equal(v9.get("kleur@4.1.5").integrity, "sha512-kleur");
  assert.equal(v9.get("esbuild@0.25.0").installScript, true);
  const v5 = parsePnpmLock(PNPM_V5);
  assert.deepEqual([...v5.keys()].sort(), ["@scope/tool@2.0.0", "kleur@4.1.5"]);
});

test("package-lock v1 and v3 both parse", () => {
  const v3 = parsePackageLock(JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "x" }, "node_modules/a": { version: "1.0.0", integrity: "i1" }, "node_modules/a/node_modules/@s/b": { version: "2.0.0" }, "node_modules/link": { link: true } } }));
  assert.deepEqual([...v3.keys()].sort(), ["@s/b@2.0.0", "a@1.0.0"]);
  const v1 = parsePackageLock(JSON.stringify({ lockfileVersion: 1, dependencies: { a: { version: "1.0.0", dependencies: { b: { version: "3.0.0" } } } } }));
  assert.deepEqual([...v1.keys()].sort(), ["a@1.0.0", "b@3.0.0"]);
});

test("the diff lists added, removed, changed, swapped and install-script packages", () => {
  const before = parsePnpmLock(PNPM_V9);
  const after = parsePnpmLock(
    PNPM_V9.replace("sha512-old", "sha512-swapped")
      .replace("kleur@4.1.5:\n    resolution", "kleur@4.1.6:\n    resolution")
      .replace(/ {2}esbuild@0\.25\.0:[\s\S]*?requiresBuild: true\n/, "  left-pad@1.3.0:\n    resolution: {integrity: sha512-lp}\n    requiresBuild: true\n"),
  );
  const diff = diffLockfiles(before, after);
  assert.deepEqual(diff.added, [{ name: "left-pad", versions: ["1.3.0"] }]);
  assert.deepEqual(diff.removed, [{ name: "esbuild", versions: ["0.25.0"] }]);
  assert.deepEqual(diff.changed, [{ name: "kleur", from: ["4.1.5"], to: ["4.1.5", "4.1.6"] }]);
  assert.deepEqual(diff.tampered.map((t) => t.name), ["@scope/tool"]);
  assert.deepEqual(diff.installScripts, [{ name: "left-pad", version: "1.3.0" }]);
});
