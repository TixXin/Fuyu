import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { devPluginsDir, installDemo } from "../../scripts/plugins-v3/install-demo.mjs";

const dirs = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function temp() {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-demo-"));
  dirs.push(dir);
  return dir;
}

test("the demo plugin is copied in and listed once, over an empty list or next to other plugins", () => {
  const empty = temp();
  writeFileSync(join(empty, "plugins.yml"), "[]\n");
  assert.equal(installDemo(empty).added, true);
  assert.equal(readFileSync(join(empty, "plugins.yml"), "utf8"), "- id: hello\n  name: ./hello/host.mjs\n");
  assert.ok(existsSync(join(empty, "hello", "host.mjs")) && existsSync(join(empty, "hello", "island.js")));
  assert.equal(installDemo(empty).added, false);
  assert.equal(readFileSync(join(empty, "plugins.yml"), "utf8").match(/id: hello/g).length, 1);
  const busy = temp();
  writeFileSync(join(busy, "plugins.yml"), "- id: other\n  name: ./other.mjs");
  installDemo(busy);
  assert.equal(readFileSync(join(busy, "plugins.yml"), "utf8"), "- id: other\n  name: ./other.mjs\n- id: hello\n  name: ./hello/host.mjs\n");
});

test("the development build's plugin folder is where each system keeps the lane's data", () => {
  assert.equal(devPluginsDir({ lane: "1", platform: "darwin", home: "/Users/me" }), join("/Users/me", "Library", "Application Support", "com.tixxin.fuyu.lane-1", "plugins-v3"));
  assert.equal(devPluginsDir({ lane: "3", platform: "win32", env: { APPDATA: "C:\\Users\\me\\AppData\\Roaming" }, home: "C:\\Users\\me" }), join("C:\\Users\\me\\AppData\\Roaming", "com.tixxin.fuyu.lane-3", "plugins-v3"));
});
