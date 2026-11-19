import assert from "node:assert/strict";
import { test } from "node:test";
import { hasLowLabel, restoreDebugIntegrity } from "../../scripts/dev-integrity.mjs";

const ACCESS = [
  "E:\\Projects\\fuyu\\src-tauri\\target\\debug S-1-4-1073080335-476748287:(I)(OI)(CI)(W,D,DC)",
  "                                          BUILTIN\\Administrators:(I)(F)",
  "                                          NT AUTHORITY\\Authenticated Users:(I)(M)",
];
const SUMMARY = ["", "Successfully processed 1 files; Failed processing 0 files"];

test("a Low label inherited from the workspace is found in icacls output", () => {
  const output = [...ACCESS, "                                          Mandatory Label\\Low Mandatory Level:(I)(OI)(CI)(NW)", ...SUMMARY].join("\r\n");
  assert.equal(hasLowLabel(output), true);
});

test("a Low label is found when Windows names it in Chinese", () => {
  assert.equal(hasLowLabel([...ACCESS, "        强制标签\\低强制级别:(OI)(CI)(NW)", ...SUMMARY].join("\n")), true);
});

test("Medium, High or no label at all are left alone", () => {
  for (const label of ["Mandatory Label\\Medium Mandatory Level:(OI)(CI)(NW)", "Mandatory Label\\High Mandatory Level:(NW)", null]) {
    const lines = label ? [...ACCESS, `        ${label}`, ...SUMMARY] : [...ACCESS, ...SUMMARY];
    assert.equal(hasLowLabel(lines.join("\r\n")), false, String(label));
  }
});

test("nothing is checked outside Windows", () => {
  assert.equal(restoreDebugIntegrity("/nowhere", "darwin"), "skipped");
  assert.equal(restoreDebugIntegrity("/nowhere", "linux"), "skipped");
});
