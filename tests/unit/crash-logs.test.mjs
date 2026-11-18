import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crashLogFileName, crashLogTarget } from "../../src/windows/settings/sections/crashLogsModel.ts";

describe("crashLogsModel", () => {
  it("extracts basename from Windows and POSIX crash log paths", () => {
    assert.equal(crashLogFileName("C:\\Users\\demo\\.fuyu\\crash.log"), "crash.log");
    assert.equal(crashLogFileName("/Users/demo/.fuyu/webview-crashes.log"), "webview-crashes.log");
    assert.equal(crashLogFileName(null), null);
    assert.equal(crashLogFileName("   "), null);
  });

  it("reveals the crash log file when present and falls back to the home folder otherwise", () => {
    assert.deepEqual(
      crashLogTarget("C:\\Users\\demo\\.fuyu", "C:\\Users\\demo\\.fuyu\\crash.log"),
      { path: "C:\\Users\\demo\\.fuyu\\crash.log", hasLog: true, fileName: "crash.log" },
    );
    assert.deepEqual(
      crashLogTarget("/Users/demo/.fuyu", null),
      { path: "/Users/demo/.fuyu", hasLog: false, fileName: null },
    );
  });
});
