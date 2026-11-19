import assert from "node:assert/strict";
import test from "node:test";
import { chatCapability, chatTone, needsAccess, summarizeSources } from "../../src/features/messages/settings/sourceRows.ts";

const windows = { mac: false, wechatExposeUi: false };

test("on Windows a source says whether it can read who wrote and what", () => {
  assert.equal(chatCapability("qq", windows), "full");
  assert.equal(chatCapability("discord", windows), "full");
  assert.equal(chatCapability("whatsapp", windows), "full");
  for (const source of ["telegram", "tim", "feishu", "dingtalk", "wecom"]) assert.equal(chatCapability(source, windows), "remind");
});

test("WeChat only reads the contact and message once that option is on", () => {
  assert.equal(chatCapability("wechat", windows), "remind");
  assert.equal(chatCapability("wechat", { mac: false, wechatExposeUi: true }), "full");
});

test("on a Mac every chat app only knows its unread count went up", () => {
  for (const source of ["qq", "wechat", "telegram", "discord"]) assert.equal(chatCapability(source, { mac: true, wechatExposeUi: true }), "count");
});

test("a source that is off never asks for access or shows a problem", () => {
  assert.equal(needsAccess({ enabled: false, status: "permissionRequired" }), false);
  assert.equal(chatTone({ enabled: false, status: "error", error: "boom" }, false), "off");
});

test("a row is a problem on Windows and a wait on a Mac while access is missing", () => {
  const waiting = { enabled: true, status: "permissionDenied" };
  assert.equal(needsAccess(waiting), true);
  assert.equal(chatTone(waiting, false), "problem");
  assert.equal(chatTone(waiting, true), "warn");
});

test("a row is fine while listening, busy while connecting and a problem on an error", () => {
  assert.equal(chatTone({ enabled: true, status: "listening" }, false), "ok");
  assert.equal(chatTone({ enabled: true, status: "waiting" }, false), "busy");
  assert.equal(chatTone({ enabled: true, status: "error" }, false), "problem");
  assert.equal(chatTone({ enabled: true, status: "listening", error: "QQ is not signed in" }, false), "problem");
});

test("the summary counts what is on, what is connecting and what needs the user", () => {
  const chats = [
    { enabled: true, status: "listening" },
    { enabled: true, status: "waiting" },
    { enabled: true, status: "permissionRequired" },
    { enabled: false, status: "disabled" },
  ];
  assert.deepEqual(summarizeSources(chats, { enabled: true, stale: 2 }, false), { on: 4, problems: 3, busy: 1 });
  assert.deepEqual(summarizeSources(chats, { enabled: false, stale: 2 }, false), { on: 3, problems: 1, busy: 1 });
});

test("on a Mac the missing Accessibility access counts once, however many apps wait for it", () => {
  const chats = [
    { enabled: true, status: "permissionRequired" },
    { enabled: true, status: "permissionDenied" },
    { enabled: true, status: "permissionRequired" },
  ];
  assert.deepEqual(summarizeSources(chats, { enabled: false, stale: 0 }, true), { on: 3, problems: 1, busy: 0 });
});
