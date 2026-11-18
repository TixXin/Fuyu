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

test("PageLeaveReinstall and un.onInit propagate /REINSTALL before _?=$4", () => {
  assert.match(template, /\nVar ReinstallMode\n/);
  const pageLeaveStart = template.indexOf("Function PageLeaveReinstall\n");
  const pageLeaveEnd = template.indexOf("\nFunctionEnd", pageLeaveStart);
  assert.ok(pageLeaveStart >= 0 && pageLeaveEnd > pageLeaveStart);
  const pageLeave = template.slice(pageLeaveStart, pageLeaveEnd);

  const appendReinstall = pageLeave.indexOf('StrCpy $R1 "$R1 /REINSTALL"');
  const appendDir = pageLeave.indexOf('StrCpy $R1 "$R1 _?=$4"');
  assert.ok(appendReinstall > 0, "expected /REINSTALL to be appended in PageLeaveReinstall");
  assert.ok(appendReinstall < appendDir, "expected /REINSTALL to appear before _?=$4");

  const unInitStart = template.indexOf("Function un.onInit\n");
  const unInitEnd = template.indexOf("\nFunctionEnd", unInitStart);
  assert.ok(unInitStart >= 0 && unInitEnd > unInitStart);
  const unInit = template.slice(unInitStart, unInitEnd);
  assert.match(unInit, /\$\{GetOptions\} \$CMDLINE "\/REINSTALL" \$ReinstallMode/);
  assert.match(unInit, /StrCpy \$ReinstallMode 1/);
});

test("Section Uninstall runs --uninstall-cleanup after CheckIfAppIsRunning and before deleting binary or APPDATA", () => {
  const uninstallStart = template.indexOf("Section Uninstall\n");
  const uninstallEnd = template.indexOf("\nSectionEnd", uninstallStart);
  assert.ok(uninstallStart >= 0 && uninstallEnd > uninstallStart);
  const section = template.slice(uninstallStart, uninstallEnd);

  const checkRunning = section.indexOf('!insertmacro CheckIfAppIsRunning "$INSTDIR\\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"');
  const cleanupDeleteData = section.indexOf('ExecWait \'"$INSTDIR\\${MAINBINARYNAME}.exe" --uninstall-cleanup --delete-data\'');
  const cleanupKeepData = section.indexOf('ExecWait \'"$INSTDIR\\${MAINBINARYNAME}.exe" --uninstall-cleanup\'');
  const deleteBinary = section.indexOf('Delete "$INSTDIR\\${MAINBINARYNAME}.exe"');
  const rmAppData = section.indexOf('RmDir /r "$APPDATA\\${BUNDLEID}"');

  assert.ok(checkRunning >= 0, "expected CheckIfAppIsRunning in Section Uninstall");
  assert.ok(cleanupDeleteData > checkRunning, "expected --uninstall-cleanup --delete-data after CheckIfAppIsRunning");
  assert.ok(cleanupKeepData > cleanupDeleteData, "expected --uninstall-cleanup fallback branch");
  assert.ok(deleteBinary > cleanupKeepData, "expected main binary deletion after --uninstall-cleanup");
  assert.ok(rmAppData > deleteBinary, "expected $APPDATA removal after main binary deletion");

  const cleanupBlock = section.slice(checkRunning, deleteBinary);
  assert.match(cleanupBlock, /\$\{If\} \$UpdateMode <> 1/);
  assert.match(cleanupBlock, /\$\{AndIf\} \$ReinstallMode <> 1/);
  assert.match(cleanupBlock, /\$\{If\} \$DeleteAppDataCheckboxState = 1/);
});
