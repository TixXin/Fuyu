import assert from "node:assert/strict";
import test from "node:test";
import { formatAge, formatAgo } from "../../src/components/list/formatAgo.ts";
import { en, zhCN } from "../../src/i18n/sections/common.ts";

const MINUTE = 60_000;

test("an age switches from minutes to hours to days", () => {
  const cases = [
    [0, "刚刚", "just now"],
    [59_000, "刚刚", "just now"],
    [MINUTE, "1 分钟前", "1 min ago"],
    [59 * MINUTE, "59 分钟前", "59 min ago"],
    [60 * MINUTE, "1 小时前", "1 h ago"],
    [23 * 60 * MINUTE + 59 * MINUTE, "23 小时前", "23 h ago"],
    [24 * 60 * MINUTE, "1 天前", "1 day ago"],
    [2758 * MINUTE, "1 天前", "1 day ago"],
    [3 * 24 * 60 * MINUTE, "3 天前", "3 days ago"],
    [-5 * MINUTE, "刚刚", "just now"],
  ];
  for (const [ms, zh, english] of cases) {
    assert.equal(formatAge(ms, zhCN.ago), zh, `${ms} ms`);
    assert.equal(formatAge(ms, en.ago), english, `${ms} ms`);
  }
});

test("a list time keeps today in hours and older days as yesterday or a date", () => {
  const now = new Date(2026, 10, 15, 12, 0).getTime();
  assert.equal(formatAgo(now - 30 * MINUTE, now, zhCN.ago), "30 分钟前");
  assert.equal(formatAgo(now - 3 * 60 * MINUTE, now, zhCN.ago), "3 小时前");
  assert.equal(formatAgo(new Date(2026, 10, 14, 9, 5).getTime(), now, zhCN.ago), "昨天 09:05");
  assert.equal(formatAgo(new Date(2026, 10, 2, 9, 5).getTime(), now, en.ago), "Nov 2");
});
