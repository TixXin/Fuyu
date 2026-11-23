import assert from "node:assert/strict";
import test from "node:test";
import { unreadRows } from "../../src/features/messages/plugin/unreadRows.ts";

const none = { qq: 0, wechat: false, mail: 0, other: 0, pendingIm: null };

test("the big number adds mail to the other counted sources", () => {
  const { rows, total } = unreadRows({ ...none, qq: 1, mail: 10 });
  assert.equal(total, 11);
  assert.deepEqual(rows.map((row) => [row.key, row.count]), [["qq", 1], ["mail", 10]]);
});

test("a pending WeChat flag shows as a row without a count and adds nothing to the total", () => {
  const { rows, total } = unreadRows({ ...none, wechat: true });
  assert.equal(total, 0);
  assert.deepEqual(rows, [{ source: "wechat", key: "wechat", count: null }]);
});

test("other IM sources count only when one of them has a pending source", () => {
  assert.equal(unreadRows({ ...none, other: 3 }).total, 0);
  assert.equal(unreadRows({ ...none, other: 3, pendingIm: "telegram" }).total, 3);
});
