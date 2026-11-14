import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { METHOD_NOT_FOUND, startMockHost } from "../src/test/index.mjs";

const CLIENT = new URL("../src/client.mjs", import.meta.url);

const MAIN = `import { createPlugin } from "./client.mjs";
const plugin = createPlugin();
const report = (name, value) => plugin.log(name + " " + JSON.stringify(value));
const attempt = async (name, run) => {
  try { report(name, await run()); } catch (error) { report(name, { code: error.code, status: error.data?.status }); }
};
plugin.onReady(async (context) => {
  report("ready", context.experimentalApis ?? null);
  await attempt("early", () => plugin.windows.create("launcher", { kind: "panel", entry: "panel.html" }));
  report("widget", await plugin.windows.create("clock", { kind: "widget", entry: "clock.html", bounds: { x: 10, y: 10, width: 1, height: 1 } }));
  await attempt("noFocus", () => plugin.windows.focus("clock"));
  await attempt("blur", () => plugin.windows.update("clock", { hideOnBlur: true }));
  await attempt("kind", () => plugin.windows.update("clock", { kind: "panel" }));
  report("screens", await plugin.screens.list());
});
plugin.onCommand("open", async () => {
  report("panel", await plugin.windows.create("launcher", { kind: "panel", entry: "panel.html" }));
  await attempt("again", () => plugin.windows.create("launcher", { kind: "panel", entry: "panel.html" }));
  report("sent", await plugin.windows.postMessage("launcher", { hello: true }));
  await plugin.windows.hide("launcher");
  report("list", (await plugin.windows.list()).map((window) => [window.id, window.kind, window.visible, window.layer]));
  await plugin.windows.close("clock");
  report("left", (await plugin.windows.list()).map((window) => window.id));
});
plugin.windows.onMessage("launcher", (message) => report("message", message));
`;

function makePlugin(manifest) {
  const dir = path.join(mkdtempSync(path.join(os.tmpdir(), "fuyu-windows-test-")), manifest.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "fuyu-plugin.json"), JSON.stringify(manifest));
  writeFileSync(path.join(dir, "main.mjs"), MAIN);
  copyFileSync(CLIENT, path.join(dir, "client.mjs"));
  return dir;
}

const manifest = (extra) => ({
  id: "me.windows",
  name: { "zh-CN": "窗口", en: "Windows" },
  version: "1.0.0",
  apiVersion: 2,
  runtime: { type: "process", command: "main.mjs" },
  permissions: ["windows"],
  ...extra,
});

const logged = async (host, name) => JSON.parse((await host.waitForLog(`${name} `)).slice(name.length + 1));

test("the mock host has the experimental window methods", async () => {
  const host = startMockHost(makePlugin(manifest({ experimentalApis: ["windows"] })));
  try {
    assert.deepEqual(await logged(host, "ready"), ["windows"]);
    assert.deepEqual(await logged(host, "early"), { code: -32000, status: 403 }, "a panel only soon after the user used the plugin");
    const widget = await logged(host, "widget");
    assert.equal(widget.layer, "desktop");
    assert.deepEqual([widget.bounds.width, widget.bounds.height], [48, 48]);
    assert.deepEqual(await logged(host, "noFocus"), { code: -32000, status: 400 });
    assert.deepEqual(await logged(host, "blur"), { code: -32000, status: 400 });
    assert.deepEqual(await logged(host, "kind"), { code: -32000, status: 400 });
    assert.equal((await logged(host, "screens"))[0].primary, true);

    host.command("open");
    const panel = await logged(host, "panel");
    assert.deepEqual([panel.kind, panel.visible, panel.focused, panel.layer], ["panel", true, true, "topmost"]);
    assert.deepEqual(await logged(host, "again"), { code: -32000, status: 409 });
    assert.deepEqual(await logged(host, "sent"), { delivered: true });
    assert.deepEqual(host.windows.get("launcher").messages, [{ hello: true }]);
    assert.deepEqual(await logged(host, "list"), [["clock", "widget", true, "desktop"], ["launcher", "panel", false, "topmost"]]);
    assert.deepEqual(await logged(host, "left"), ["launcher"]);

    host.windowMessage("launcher", { typed: "abc" });
    assert.deepEqual(await logged(host, "message"), { typed: "abc" });
  } finally {
    await host.stop();
  }
});

test("without experimentalApis the window methods are unknown", async () => {
  const host = startMockHost(makePlugin(manifest({})));
  try {
    assert.equal(await logged(host, "ready"), null);
    assert.deepEqual(await logged(host, "early"), { code: METHOD_NOT_FOUND });
  } finally {
    await host.stop();
  }
});
