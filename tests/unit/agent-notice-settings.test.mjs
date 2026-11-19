import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/lib/settings/settings.ts";

test("agent notice settings default to the recommended set and fall back per field", () => {
  const notice = normalizeSettings({});
  assert.equal(notice.agentNoticeStyle, "status");
  assert.equal(notice.agentNoticeNotch, "band");
  assert.equal(notice.agentNoticeMessageLines, 6);
  assert.equal(notice.agentNoticeCommandLines, 3);
  assert.equal(notice.agentNoticeMarkdown, true);
  assert.equal(notice.agentNoticeMeta, "hover");
  assert.equal(notice.agentNoticeScrollbar, "auto");
  assert.equal(notice.agentNoticeYourTurnSeconds, 0);
  assert.equal(notice.agentNoticeFailedSeconds, 0);
  assert.equal(notice.agentNoticeHoverHold, true);
  assert.equal(notice.agentNoticeClick, "window");
  assert.equal(notice.agentNoticeStack, "peek");
  assert.equal(notice.agentNoticeButtonOrder, "allowRight");
  assert.equal(notice.agentNoticeShortcuts, true);
  for (const [key, value] of Object.entries(notice)) {
    if (key.startsWith("agentNotice")) assert.equal(DEFAULT_SETTINGS[key], value, key);
  }
  const saved = normalizeSettings({ agentNoticeStyle: "wings", agentNoticeMessageLines: 0, agentNoticeMarkdown: false, agentNoticeFailedSeconds: 10, agentNoticeStack: "nope" });
  assert.equal(saved.agentNoticeStyle, "wings");
  assert.equal(saved.agentNoticeMessageLines, 0);
  assert.equal(saved.agentNoticeMarkdown, false);
  assert.equal(saved.agentNoticeFailedSeconds, 10);
  assert.equal(saved.agentNoticeStack, "peek");
});
