import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SUMMARY_MESSAGE_CHARS,
  MAX_SUMMARY_STACK_CHARS,
  createReportLimiter,
  isNoise,
  summarizeError,
} from "../../src/lib/crash-report/errorSummary.ts";
import { CRASH_RELOAD_WINDOW_MS, crashVariant, nextCrashStep, parseReloadAt } from "../../src/lib/crash-report/recovery.ts";

test("the first crash reloads, a crash right after a reload shows the fallback, a later one reloads again", () => {
  const at = 1_800_000_000_000;
  assert.equal(nextCrashStep({ now: at, lastReloadAt: null, dev: false }), "reload");
  assert.equal(nextCrashStep({ now: at + 500, lastReloadAt: at, dev: false }), "fallback");
  assert.equal(nextCrashStep({ now: at + CRASH_RELOAD_WINDOW_MS - 1, lastReloadAt: at, dev: false }), "fallback");
  assert.equal(nextCrashStep({ now: at + CRASH_RELOAD_WINDOW_MS, lastReloadAt: at, dev: false }), "reload");
});

test("a clock that went backwards does not leave the window stuck on the fallback", () => {
  assert.equal(nextCrashStep({ now: 1000, lastReloadAt: 9_000_000, dev: false }), "reload");
});

test("the dev build never reloads by itself, the broken code would crash again", () => {
  assert.equal(nextCrashStep({ now: 5, lastReloadAt: null, dev: true }), "fallback");
});

test("a missing or broken stored reload time counts as never reloaded", () => {
  for (const raw of [null, "", "  ", "abc", "-5", "0", "NaN", "Infinity"]) assert.equal(parseReloadAt(raw), null, String(raw));
  assert.equal(parseReloadAt("1800000000000"), 1_800_000_000_000);
});

test("the island gets the pill, the click-through drag grid shows nothing, other windows get the card", () => {
  assert.equal(crashVariant(null), "island");
  assert.equal(crashVariant("drag-grid"), "silent");
  for (const kind of ["settings", "translation", "clipboard", "clipboard-preview", "screenshot", "pin", "tray-menu", "onboarding", "plugin-window"]) {
    assert.equal(crashVariant(kind), "window", kind);
  }
});

test("an Error becomes its name and message, with the frames and the component stack and without the page origin", () => {
  const error = new TypeError("Cannot read properties of undefined (reading 'title')");
  error.stack = [
    "TypeError: Cannot read properties of undefined (reading 'title')",
    "    at IslandShell (http://tauri.localhost/assets/IslandApp-abc.js:1:2345)",
    "    at renderWithHooks (tauri://localhost/assets/index-def.js:9:10)",
  ].join("\r\n");
  const summary = summarizeError(error, "\n    at IslandShell\n    at IslandApp\n");
  assert.equal(summary.message, "TypeError: Cannot read properties of undefined (reading 'title')");
  assert.equal(
    summary.stack,
    "at IslandShell (assets/IslandApp-abc.js:1:2345)\nat renderWithHooks (assets/index-def.js:9:10)\nat IslandShell\nat IslandApp",
  );
});

test("a WebKit stack has no header line, so its first frame is kept", () => {
  const error = new Error("boom");
  error.stack = "render@tauri://localhost/assets/a.js:1:2\nperform@tauri://localhost/assets/b.js:3:4";
  assert.equal(summarizeError(error).stack, "render@assets/a.js:1:2\nperform@assets/b.js:3:4");
  const blank = new Error("");
  blank.stack = "render@tauri://localhost/assets/a.js:1:2";
  assert.deepEqual(summarizeError(blank), { message: "Error:", stack: "render@assets/a.js:1:2" });
});

test("things that are not errors are still described", () => {
  assert.deepEqual(summarizeError("plain text"), { message: "plain text", stack: null });
  assert.deepEqual(summarizeError({ code: "mail.timeout" }), { message: '{"code":"mail.timeout"}', stack: null });
  assert.deepEqual(summarizeError(undefined), { message: "undefined", stack: null });
  assert.deepEqual(summarizeError(null), { message: "null", stack: null });
  assert.deepEqual(summarizeError(""), { message: "unknown error", stack: null });
  const loop = {};
  loop.self = loop;
  assert.deepEqual(summarizeError(loop), { message: "[object Object]", stack: null });
});

test("long messages and stacks are cut before they are sent", () => {
  const error = new Error("m".repeat(5000));
  error.stack = `Error: ${"m".repeat(5000)}\n${"at frame (assets/a.js:1:1)\n".repeat(500)}`;
  const summary = summarizeError(error);
  assert.equal(summary.message.length, MAX_SUMMARY_MESSAGE_CHARS);
  assert.equal(summary.stack.length, MAX_SUMMARY_STACK_CHARS);
});

test("browser noise is not reported", () => {
  assert.equal(isNoise("ResizeObserver loop completed with undelivered notifications."), true);
  assert.equal(isNoise("ResizeObserver loop limit exceeded"), true);
  assert.equal(isNoise("Script error."), true);
  assert.equal(isNoise("TypeError: ResizeObserver loop is not a function"), false);
});

test("the same error is reported once and a page stops reporting after its limit", () => {
  const allow = createReportLimiter(3);
  assert.equal(allow("render:a"), true);
  assert.equal(allow("render:a"), false);
  assert.equal(allow("error:a"), true);
  assert.equal(allow("render:b"), true);
  assert.equal(allow("render:c"), false);
  assert.equal(allow("render:a"), false);
});
