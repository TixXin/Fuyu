import assert from "node:assert/strict";
import { test } from "node:test";
import { debugBuildPids, sideLane } from "../../scripts/stop-running-island.mjs";

test("a side lane is a whole number from 1 to 999, like the Rust side reads it", () => {
  assert.equal(sideLane({}), null);
  assert.equal(sideLane({ FOCUSD_DEV_LANE: "" }), null);
  assert.equal(sideLane({ FOCUSD_DEV_LANE: "1" }), 1);
  assert.equal(sideLane({ FOCUSD_DEV_LANE: "999" }), 999);
  assert.equal(sideLane({ FOCUSD_DEV_LANE: "0" }), null);
  assert.equal(sideLane({ FOCUSD_DEV_LANE: "1000" }), null);
  assert.equal(sideLane({ FOCUSD_DEV_LANE: "one" }), null);
  assert.equal(sideLane({ FOCUSD_DEV_LANE: "1.5" }), null);
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
