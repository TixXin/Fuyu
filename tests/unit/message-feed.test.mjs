import assert from "node:assert/strict";
import test from "node:test";
import { READ_MAIL_WINDOW_MS, buildFeed, bucketOf, groupByConversation, groupRuns, unreadTotal } from "../../src/features/messages/feed/feedModel.ts";
import { DEFAULT_MESSAGE_LAYOUT, normalizeMessageLayout } from "../../src/features/messages/feed/messageLayout.ts";
import { HANDLED_LIMIT, normalizeHandled, withHandled } from "../../src/features/messages/feed/storage.ts";

const now = new Date(2026, 10, 22, 15, 0, 0).getTime();
const text = { wechat: "微信", newReminder: "有新提醒", plainReason: () => "托盘闪烁", flashBody: "有新消息", noSubject: "（无主题）" };
const box = (items, extra = {}) => ({ revision: 1, email: "demo@qq.com", configured: true, enabled: true, syncing: false, status: "connected", unreadCount: 0, items, lastSyncedAt: now, error: null, ...extra });
const mail = (id, receivedAt, unread, subject = "周报") => ({ id, uid: 1, sender: "产品团队", subject, receivedAt, unread });
const input = (patch = {}) => ({ qq: [], wechat: null, mailboxes: [], im: {}, handled: new Set(), findOtp: (value) => value.match(/\b\d{6}\b/)?.[0] ?? null, now, text, ...patch });

test("every source lands in one list, newest first", () => {
  const items = buildFeed(input({
    qq: [{ id: "q1", title: "设计组", body: "看一下", createdAt: now - 3_000 }],
    wechat: { items: [{ at: now - 1_000, message: { chat: "c1", contact: "小林", preview: "开会", unread: 2 }, reason: null }], pending: true, lastAttentionAt: now },
    mailboxes: [box([mail("m1", now - 2_000, true)])],
    im: { telegram: [{ id: "t1", kind: "toast", title: "Alice", body: "构建通过", createdAt: now - 4_000 }] },
  }));
  assert.deepEqual(items.map((item) => item.source), ["wechat", "qqMail", "qq", "telegram"]);
  assert.equal(items[0].unread, 2);
  assert.equal(items[0].chat, "c1");
});

test("a chat the user marked read stays in the list with no unread count", () => {
  const items = buildFeed(input({ qq: [{ id: "q1", title: "设计组", body: "看一下", createdAt: now }], handled: new Set(["qq:q1"]) }));
  assert.equal(items.length, 1);
  assert.equal(items[0].unread, 0);
  assert.equal(unreadTotal(items), 0);
});

test("WeChat pending with no readable message still shows one plain reminder", () => {
  const items = buildFeed(input({ wechat: { items: [], pending: true, lastAttentionAt: now - 60_000 } }));
  assert.equal(items.length, 1);
  assert.equal(items[0].plain, true);
  assert.equal(items[0].text, "有新提醒");
  assert.equal(items[0].at, now - 60_000);
});

test("read mail older than two days and paused or unconfigured mailboxes stay out", () => {
  const old = now - READ_MAIL_WINDOW_MS - 1;
  const items = buildFeed(input({
    mailboxes: [
      box([mail("fresh", now - 1_000, false), mail("old-read", old, false), mail("old-unread", old, true)]),
      box([mail("paused", now, true)], { email: "b@qq.com", enabled: false }),
      box([mail("setup", now, true)], { email: "c@qq.com", configured: false }),
    ],
  }));
  assert.deepEqual(items.map((item) => item.id), ["fresh", "old-unread"]);
  assert.equal(items[0].account, "demo@qq.com");
});

test("a verification code in a mail subject is picked up", () => {
  const [item] = buildFeed(input({ mailboxes: [box([mail("otp", now, true, "您的验证码 849201")])] }));
  assert.equal(item.otp, "849201");
});

test("IM flashes without text get a readable body and count as plain", () => {
  const [item] = buildFeed(input({ im: { feishu: [{ id: "f1", kind: "flash", title: "飞书", body: "", createdAt: now }] } }));
  assert.equal(item.plain, true);
  assert.equal(item.text, "有新消息");
});

test("back-to-back messages from one chat fold into a run, a gap splits it", () => {
  const items = buildFeed(input({ qq: [
    { id: "a", title: "设计组", body: "1", createdAt: now },
    { id: "b", title: "设计组", body: "2", createdAt: now - 60_000 },
    { id: "c", title: "设计组", body: "3", createdAt: now - 30 * 60_000 },
  ] }));
  assert.deepEqual(groupRuns(items).map((run) => run.lines.length), [2, 1]);
  assert.equal(groupByConversation(items)[0].unread, 3);
});

test("time buckets follow the wall clock", () => {
  assert.equal(bucketOf(now - 60_000, now), "recent");
  assert.equal(bucketOf(now - 3 * 3_600_000, now), "today");
  assert.equal(bucketOf(now - 20 * 3_600_000, now), "yesterday");
  assert.equal(bucketOf(now - 3 * 86_400_000, now), "earlier");
});

test("handled keys drop ones no longer shown and keep the newest few hundred", () => {
  assert.deepEqual(withHandled(["a", "gone"], ["b"], new Set(["a", "b"])), ["a", "b"]);
  const many = Array.from({ length: HANDLED_LIMIT + 20 }, (_, index) => `k${index}`);
  const kept = withHandled(many, ["new"]);
  assert.equal(kept.length, HANDLED_LIMIT);
  assert.equal(kept.at(-1), "new");
  assert.deepEqual(normalizeHandled(["a", "a", 3, "", null, "b"]), ["a", "b"]);
  assert.deepEqual(normalizeHandled("broken"), []);
});

test("unknown or missing layouts fall back to one at a time", () => {
  assert.equal(DEFAULT_MESSAGE_LAYOUT, "focus");
  assert.equal(normalizeMessageLayout("timeline"), "timeline");
  assert.equal(normalizeMessageLayout("cards"), "focus");
  assert.equal(normalizeMessageLayout(undefined), "focus");
});
