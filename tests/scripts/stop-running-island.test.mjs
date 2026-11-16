import assert from "node:assert/strict";
import { test } from "node:test";
import { debugBuildPids, devLane } from "../../scripts/stop-running-island.mjs";

test("a development build is lane 1 unless it shares the installed app's identity, like the Rust side reads it", () => {
  assert.equal(devLane({}), 1);
  assert.equal(devLane({ FUYU_DEV_LANE: "" }), 1);
  assert.equal(devLane({ FUYU_DEV_LANE: "7" }), 7);
  assert.equal(devLane({ FUYU_DEV_LANE: " 999 " }), 999);
  for (const odd of ["0", "1000", "one", "1.5"]) assert.equal(devLane({ FUYU_DEV_LANE: odd }), 1, odd);
  assert.equal(devLane({ FOCUSD_DEV_LANE: "7" }), 7, "the name before the rename still counts");
  assert.equal(devLane({ FUYU_DEV_LANE: "3", FOCUSD_DEV_LANE: "7" }), 3, "the new name wins");
  assert.equal(devLane({ FUYU_DEV_SHARED_IDENTITY: "1" }), null);
  assert.equal(devLane({ FUYU_DEV_SHARED_IDENTITY: "1", FUYU_DEV_LANE: "7" }), null);
  assert.equal(devLane({ FUYU_DEV_SHARED_IDENTITY: "0" }), 1);
});

test("on Windows only the island built in this checkout's debug folder is stopped", () => {
  const processes = [
    { pid: 1, file: "C:\\Users\\me\\AppData\\Local\\Fuyu\\fuyu.exe" },
    { pid: 2, file: "E:\\Projects\\fuyu\\src-tauri\\target\\debug\\fuyu.exe" },
    { pid: 3, file: "e:\\projects\\FUYU\\src-tauri\\target\\debug\\Fuyu.exe" },
    { pid: 4, file: "E:\\Projects\\fuyu\\src-tauri\\target\\release\\fuyu.exe" },
    { pid: 5, file: "E:\\Projects\\fuyu\\src-tauri\\target\\agents\\debug\\fuyu.exe" },
    { pid: 6, file: "E:\\Projects\\fuyu\\src-tauri\\target\\debug\\deps\\fuyu.exe" },
    { pid: 7, file: "" },
  ];
  assert.deepEqual(debugBuildPids(processes, "E:\\Projects\\fuyu\\src-tauri\\target\\debug", true), [2, 3]);
});

test("on a Mac the installed app and other checkouts are left alone", () => {
  const processes = [
    { pid: 1, file: "/Applications/Fuyu.app/Contents/MacOS/fuyu" },
    { pid: 2, file: "/Users/me/fuyu/src-tauri/target/debug/fuyu" },
    { pid: 3, file: "/Users/me/Fuyu/src-tauri/target/debug/fuyu" },
    { pid: 4, file: "/Users/me/fuyu/src-tauri/target/debug/fuyu-helper" },
  ];
  assert.deepEqual(debugBuildPids(processes, "/Users/me/fuyu/src-tauri/target/debug", false), [2]);
});
