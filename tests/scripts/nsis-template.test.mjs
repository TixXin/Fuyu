// The installer uses a copy of Tauri's NSIS template (src-tauri/windows/installer.nsi) so its
// shortcuts carry the Chinese name. The copy has to match the Tauri CLI that builds it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const template = readFileSync(new URL("../../src-tauri/windows/installer.nsi", import.meta.url), "utf8");
const config = JSON.parse(readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8"));

test("the NSIS template was copied from the installed Tauri CLI", () => {
  const cli = createRequire(import.meta.url)("@tauri-apps/cli/package.json").version;
  assert.match(template, new RegExp(`from tauri-cli v${cli.replace(/\./g, "\\.")} `), `copy the template of tauri-cli ${cli} and redo the "Fuyu:" changes`);
  assert.equal(config.bundle.windows.nsis.template, "windows/installer.nsi");
});

test("the installer's shortcuts are named 浮屿, and old Fuyu.lnk ones are renamed or removed", () => {
  assert.match(template, /!define SHORTCUTNAME "\$\{U\+6D6E\}\$\{U\+5C7F\}"/);
  // Only the Fuyu: macros still name the old Fuyu.lnk.
  const old = template.split("\n").filter((line) => line.includes("${PRODUCTNAME}.lnk"));
  assert.ok(old.length > 0 && old.every((line) => line.includes("${dir}")), old.join("\n"));
  assert.match(template, /Function CreateOrUpdateDesktopShortcut\n[^\n]*\n {2}!insertmacro RenameOldShortcut "\$DESKTOP"/);
  // Plain ASCII, so the encoding Tauri writes it in cannot garble the name.
  assert.ok(/^[\x00-\x7F]*$/.test(template));
});
