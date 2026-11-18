import assert from "node:assert/strict";
import test from "node:test";
import { addBannerMessage, bannerClock, bannerKey } from "../../src/features/messages/banner/bannerMessages.ts";

const message = (source, receivedAt, title = "小林") => ({ source, title, body: "下午一起开会吗？", receivedAt, durationMs: 5_000, actions: [] });

test("a banner starts with the first message and groups the ones that follow", () => {
  const first = addBannerMessage(null, message("qq", 100));
  assert.equal(first.more, 0);
  assert.equal(first.message.receivedAt, 100);

  const second = addBannerMessage(first, message("qqMail", 200, "项目组"));
  assert.equal(second.more, 1);
  assert.equal(second.message.source, "qqMail");
  assert.ok(second.version > first.version);

  const third = addBannerMessage(second, message("plugin", 300, "构建完成"));
  assert.equal(third.more, 2);
  assert.equal(third.message.title, "构建完成");
});

test("the same arrival seen again leaves the banner as it is", () => {
  const banner = addBannerMessage(null, message("qq", 100));
  assert.equal(addBannerMessage(banner, message("qq", 100)), banner);
  const withOtp = addBannerMessage(banner, { ...message("qq", 100), actions: [{ id: "copy-otp:356407", title: "复制 356407" }] });
  assert.equal(withOtp.more, banner.more);
  assert.equal(withOtp.version, banner.version);
  assert.equal(withOtp.message.actions[0]?.id, "copy-otp:356407");
  assert.equal(bannerKey(message("qq", 100)), bannerKey(message("qq", 100, "别人")));
  assert.notEqual(bannerKey(message("qq", 100)), bannerKey(message("qqMail", 100)));
});

test("the arrival time reads as a 24-hour clock", () => {
  assert.equal(bannerClock(new Date(2026, 10, 9, 9, 5).getTime()), "09:05");
  assert.equal(bannerClock(new Date(2026, 10, 9, 23, 41).getTime()), "23:41");
});

test("upgrading a taskbar-flash banner to a real toast via replacedId updates the card without inflating more", () => {
  const flash = {
    source: "telegram",
    id: "telegram:flash:1000",
    kind: "flash",
    title: "Telegram",
    body: "",
    receivedAt: 1000,
    durationMs: 5_000,
    actions: [],
  };
  const first = addBannerMessage(null, flash);
  assert.equal(first.more, 0);

  const toast = {
    source: "telegram",
    id: "telegram:toast:42:9",
    replacedId: "telegram:flash:1000",
    kind: "toast",
    title: "Alice",
    body: "验证码 482910",
    receivedAt: 1300,
    durationMs: 5_000,
    actions: [{ id: "copy-otp:482910", title: "复制 482910" }],
  };
  const upgraded = addBannerMessage(first, toast);
  assert.equal(upgraded.more, 0);
  assert.equal(upgraded.message.title, "Alice");
  assert.ok(upgraded.version > first.version);

  const withOther = addBannerMessage(first, message("qq", 1100));
  assert.equal(withOther.more, 1);
  const upgradedAfterOther = addBannerMessage(withOther, toast);
  assert.equal(upgradedAfterOther.more, 1);
});
