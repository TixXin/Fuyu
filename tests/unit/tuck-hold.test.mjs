import assert from "node:assert/strict";
import test from "node:test";
import { hasNewUnreadMail, hasUnreadMessages, holdsTuck, mailSeen, nextMailBaselines } from "../../src/windows/island/tuckHold.ts";
import { normalizeSettings } from "../../src/features/appearance/settings.ts";

const idle = { todoInProgress: false, agentWaiting: false, musicPlaying: false, messagesUnread: false };

test("by default a todo in progress or an agent waiting keeps the island out, music does not (issue #29)", () => {
  const settings = normalizeSettings({});
  assert.equal(settings.autoTuckHoldTodo, true);
  assert.equal(settings.autoTuckHoldAgent, true);
  assert.equal(settings.autoTuckHoldMusic, false);
  assert.equal(holdsTuck(settings, idle), false);
  assert.equal(holdsTuck(settings, { ...idle, todoInProgress: true }), true);
  assert.equal(holdsTuck(settings, { ...idle, agentWaiting: true }), true);
  assert.equal(holdsTuck(settings, { ...idle, musicPlaying: true }), false);
});

test("each hold follows its switch and its feature", () => {
  const settings = normalizeSettings({ autoTuckHoldMusic: true, autoTuckHoldTodo: false });
  assert.equal(holdsTuck(settings, { ...idle, musicPlaying: true }), true);
  assert.equal(holdsTuck(settings, { ...idle, todoInProgress: true }), false);
  assert.equal(holdsTuck({ ...settings, musicEnabled: false }, { ...idle, musicPlaying: true }), false);
  assert.equal(holdsTuck({ ...settings, agentStatusEnabled: false }, { ...idle, agentWaiting: true }), false);
});

test("unread messages keep the island out by default, and only while the switch is on (issue #314)", () => {
  const settings = normalizeSettings({});
  assert.equal(settings.autoTuckHoldMessages, true);
  assert.equal(holdsTuck(settings, { ...idle, messagesUnread: true }), true);
  assert.equal(holdsTuck({ ...settings, autoTuckHoldMessages: false }, { ...idle, messagesUnread: true }), false);
  assert.equal(normalizeSettings({ autoTuckHoldMessages: false }).autoTuckHoldMessages, false);
});

test("WeChat, QQ and mail unread count only when that source is on", () => {
  const none = { qq: { enabled: true, count: 0 }, wechat: { enabled: true, pending: false }, mail: { enabled: true, newUnread: false } };
  assert.equal(hasUnreadMessages(none), false);
  assert.equal(hasUnreadMessages({ ...none, qq: { enabled: true, count: 2 } }), true);
  assert.equal(hasUnreadMessages({ ...none, wechat: { enabled: true, pending: true } }), true);
  assert.equal(hasUnreadMessages({ ...none, mail: { enabled: true, newUnread: true } }), true);
  assert.equal(hasUnreadMessages({ qq: { enabled: false, count: 2 }, wechat: { enabled: false, pending: true }, mail: { enabled: false, newUnread: true } }), false);
});

test("mail counts only unread that arrived since the messages were last seen", () => {
  const box = (unreadCount, enabled = true) => [{ email: "me@example.com", enabled, unreadCount }];
  let baselines = nextMailBaselines({}, box(null), false);
  assert.equal(hasNewUnreadMail(baselines, box(null)), false);
  baselines = nextMailBaselines(baselines, box(120), false);
  assert.equal(hasNewUnreadMail(baselines, box(120)), false, "an inbox that always has unread mail does not hold");
  baselines = nextMailBaselines(baselines, box(121), false);
  assert.equal(hasNewUnreadMail(baselines, box(121)), true, "a new mail holds");
  assert.equal(hasNewUnreadMail(baselines, box(121, false)), false, "a turned-off mailbox does not hold");
  assert.equal(mailSeen({ messagesOpen: false, previewSource: "qqMail" }), false, "a mail preview on the island is not seeing it");
  baselines = nextMailBaselines(baselines, box(121), mailSeen({ messagesOpen: false, previewSource: "qqMail" }));
  assert.equal(hasNewUnreadMail(baselines, box(121)), true, "so the new mail still holds after its preview");
  baselines = nextMailBaselines(baselines, box(121), mailSeen({ messagesOpen: true, previewSource: null }));
  assert.equal(hasNewUnreadMail(baselines, box(121)), false, "once seen, it lets go");
  baselines = nextMailBaselines(baselines, box(100), false);
  baselines = nextMailBaselines(baselines, box(101), false);
  assert.equal(hasNewUnreadMail(baselines, box(101)), true, "reading mail elsewhere lowers the baseline, so the next one still holds");
});
