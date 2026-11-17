import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const template = readFileSync(new URL("../../src-tauri/windows/installer.nsi", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const config = JSON.parse(readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8"));

test("the NSIS template was copied from the installed Tauri CLI", () => {
  const cli = createRequire(import.meta.url)("@tauri-apps/cli/package.json").version;
  assert.match(template, new RegExp(`from tauri-cli v${cli.replace(/\./g, "\\.")} `), `copy the template of tauri-cli ${cli} and redo the "Fuyu:" changes`);
  assert.equal(config.bundle.windows.nsis.template, "windows/installer.nsi");
});

test("the NSIS template is pure ASCII so shortcut names do not depend on file encoding", () => {
  assert.ok(/^[\x00-\x7F]*$/.test(template));
});
