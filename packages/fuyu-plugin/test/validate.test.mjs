import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isIgnored, parseIgnore } from "../src/ignore.mjs";
import { validateSchema } from "../src/json-schema.mjs";
import { createZip, packageFiles, packFolder } from "../src/pack.mjs";
import { protocol } from "../src/schema.mjs";
import { permissionsUsed, validatePlugin } from "../src/validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const base = {
  id: "me.sample",
  name: { "zh-CN": "示例", en: "Sample" },
  description: { "zh-CN": "示例", en: "Sample" },
  version: "1.0.0",
  apiVersion: 2,
  runtime: { type: "process", command: "main.mjs" },
  permissions: [],
};

function withPlugin(manifest, files, run) {
  const dir = path.join(mkdtempSync(path.join(os.tmpdir(), "fuyu-validate-")), manifest.id ?? "plugin");
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(dir, "fuyu-plugin.json"), JSON.stringify(manifest));
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), text);
    }
    return run(dir);
  } finally {
    rmSync(path.dirname(dir), { recursive: true, force: true });
  }
}

test("the example plugins validate without errors or warnings", () => {
  const examples = path.join(root, "plugins/examples");
  for (const id of readdirSync(examples)) {
    const result = validatePlugin(path.join(examples, id));
    assert.deepEqual(result.errors, [], id);
    assert.deepEqual(result.warnings, [], id);
  }
});

test("schema errors name the field", () => {
  const errors = validateSchema(protocol().manifestSchema, { ...base, id: "Bad", apiVersion: 3, contributes: { views: [{ id: "v", title: "x", template: "chart" }] } });
  const text = errors.map((error) => `${error.path} ${error.message}`).join("\n");
  assert.match(text, /^id must match/m);
  assert.match(text, /^apiVersion must be at most 2/m);
  assert.match(text, /contributes\.views\[0\]\.title must be object/);
  assert.match(text, /contributes\.views\[0\]\.template must be one of/);
  assert.deepEqual(validateSchema(protocol().manifestSchema, base), []);
});

test("runtime.command must exist, stay inside and be packed", () => {
  withPlugin(base, {}, (dir) => assert.match(validatePlugin(dir).errors.join("\n"), /does not exist/));
  withPlugin({ ...base, runtime: { type: "process", command: "../x.mjs" } }, {}, (dir) => assert.match(validatePlugin(dir).errors.join("\n"), /inside the plugin folder/));
  withPlugin(base, { "main.mjs": "", ".fuyuignore": "*.mjs\n" }, (dir) => assert.match(validatePlugin(dir).errors.join("\n"), /left out by .fuyuignore/));
  withPlugin(base, { "main.mjs": "" }, (dir) => assert.deepEqual(validatePlugin(dir).errors, []));
});

test("experimentalApis is only accepted in development mode", () => {
  const manifest = { ...base, experimentalApis: ["views.chart"] };
  withPlugin(manifest, { "main.mjs": "" }, (dir) => {
    assert.match(validatePlugin(dir).errors.join("\n"), /experimentalApis only works in development mode/);
    assert.deepEqual(validatePlugin(dir, { allowExperimental: true }).errors, []);
  });
});

test("activation events and menus must point at real contributions", () => {
  const manifest = {
    ...base,
    activationEvents: ["onCommand:nope", "onView:gone", "onEvent:todos.changed", "onEvent:nothing", "onSchedule:2"],
    contributes: { commands: [{ id: "go", title: { "zh-CN": "走", en: "Go" } }], menus: { "todo/context": [{ command: "missing" }] } },
  };
  withPlugin(manifest, { "main.mjs": "" }, (dir) => {
    const errors = validatePlugin(dir).errors.join("\n");
    for (const expected of [/no command "nope"/, /no view "gone"/, /needs the permission todos:read/, /no event "nothing"/, /5 to 1440/, /names "missing"/]) {
      assert.match(errors, expected);
    }
  });
});

test("permissions are compared with the methods and events the code mentions", () => {
  assert.deepEqual([...permissionsUsed(['await plugin.call("todos.add", {})', "plugin.onEvent('clipboard.changed')"])].sort(), ["clipboard:read", "todos:write"]);
  assert.deepEqual([...permissionsUsed(["Show-FuyuNotification 'Hi'", "plugin.note.append('x')"])].sort(), ["island:notify", "notes:write"]);
  assert.deepEqual([...permissionsUsed(["const todos = 1; // the todos.listing page"])], []);
  withPlugin({ ...base, permissions: ["secrets"] }, { "main.mjs": "plugin.todos.list()", "lib/fuyu.mjs": "call('media.next')" }, (dir) => {
    const warnings = validatePlugin(dir).warnings.join("\n");
    assert.match(warnings, /secrets seems unused/);
    assert.match(warnings, /seems to use todos:read/);
    assert.doesNotMatch(warnings, /media:control/);
  });
  withPlugin({ ...base, optionalPermissions: ["todos:read"] }, { "main.mjs": "plugin.todos.list()" }, (dir) => {
    assert.doesNotMatch(validatePlugin(dir).warnings.join("\n"), /seems to use todos:read/, "an optional permission counts as asked for");
  });
});

test(".fuyuignore leaves files out of the package", () => {
  const rules = parseIgnore("# comment\ndist/\n*.log\n/notes.md\n!keep.log\nsrc/**/*.test.mjs\n");
  assert.equal(isIgnored(rules, "dist/main.mjs"), true);
  assert.equal(isIgnored(rules, "debug.log"), true);
  assert.equal(isIgnored(rules, "logs/a/debug.log"), true);
  assert.equal(isIgnored(rules, "keep.log"), false);
  assert.equal(isIgnored(rules, "notes.md"), true);
  assert.equal(isIgnored(rules, "docs/notes.md"), false);
  assert.equal(isIgnored(rules, "src/a/b/x.test.mjs"), true);
  assert.equal(isIgnored(rules, "src/x.mjs"), false);
  assert.equal(isIgnored(rules, ".fuyuignore"), true);
  assert.equal(isIgnored(rules, ".package/x.zip"), true);
  assert.equal(isIgnored(rules, "lib/.package/x"), false);

  withPlugin(base, { "main.mjs": "a", ".fuyuignore": "test/\n", "test/x.test.mjs": "b", ".package/old.zip": "c" }, (dir) => {
    // The manifest goes in under its old name too, for islands from before the rename.
    const files = packageFiles(dir);
    assert.deepEqual(files.map(([name]) => name), ["fuyu-plugin.json", "focusd-plugin.json", "main.mjs"]);
    assert.ok(files[0][1].equals(files[1][1]));
    assert.ok(createZip(packageFiles(dir)).equals(createZip(packageFiles(dir))));
  });
});

test("a plugin from before the rename keeps its focusd-plugin.json and .focusdignore", () => {
  withPlugin(base, { "main.mjs": "a", ".focusdignore": "test/\n", "test/x.test.mjs": "b" }, (dir) => {
    renameSync(path.join(dir, "fuyu-plugin.json"), path.join(dir, "focusd-plugin.json"));
    assert.deepEqual(packageFiles(dir).map(([name]) => name), ["focusd-plugin.json", "main.mjs"]);
    assert.equal(packFolder(dir).manifest.id, "me.sample");
    assert.deepEqual(validatePlugin(dir).errors, []);
    writeFileSync(path.join(dir, ".focusdignore"), "*.mjs\n");
    assert.match(validatePlugin(dir).errors.join("\n"), /left out by \.focusdignore/);
  });
  withPlugin(base, {}, (dir) => {
    rmSync(path.join(dir, "fuyu-plugin.json"));
    assert.match(validatePlugin(dir).errors.join("\n"), /There is no fuyu-plugin\.json/);
  });
});
