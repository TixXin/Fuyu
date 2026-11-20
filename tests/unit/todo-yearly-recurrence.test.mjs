import assert from "node:assert/strict";
import test from "node:test";
import { nextOccurrenceDate, readRecurrence, TODO_RECURRENCE_KINDS } from "../../src/features/todos/recurrence.ts";
import { parseTodoInlineSyntax } from "../../src/features/todos/inlineSyntax.ts";

const next = (date, kind, interval) => nextOccurrenceDate(date, interval ? { kind, interval } : { kind });

test("yearly todos come back on the same day, and 29 February falls back to the 28th", () => {
  assert.equal(next("2026-11-19", "yearly"), "2027-11-19");
  assert.equal(next("2026-11-19", "yearly", 2), "2028-11-19");
  assert.equal(next("2024-02-29", "yearly"), "2025-02-28");
  assert.equal(next("2027-12-31", "yearly"), "2028-12-31");
});

test("lunar yearly todos follow the lunar month and day", () => {
  assert.equal(next("2026-09-25", "lunarYearly"), "2027-09-15");
  assert.equal(next("2026-09-25", "lunarYearly", 2), "2028-10-03");
  assert.equal(next("2027-02-06", "lunarYearly"), "2028-01-26");
  assert.equal(next("2026-01-18", "lunarYearly"), "2027-01-07");
});

test("a leap month counts as its regular month, and day 30 moves to 29 in a short month", () => {
  assert.equal(next("2025-07-25", "lunarYearly"), "2026-07-14");
  assert.equal(next("2026-03-18", "lunarYearly"), "2027-03-07");
  assert.equal(next("2026-05-16", "lunarYearly"), "2027-05-05");
});

test("the new kinds survive reading and show up in the menu list", () => {
  assert.deepEqual(readRecurrence({ kind: "lunarYearly" }), { kind: "lunarYearly" });
  assert.deepEqual(readRecurrence({ kind: "yearly", interval: 2 }), { kind: "yearly", interval: 2 });
  assert.deepEqual(TODO_RECURRENCE_KINDS.slice(-2), ["yearly", "lunarYearly"]);
});

test("typing @每年 or @农历每年 after a todo sets the yearly kinds", () => {
  assert.deepEqual(parseTodoInlineSyntax("妈妈生日 @农历每年", "2026-11-19"), { title: "妈妈生日", recurrence: { kind: "lunarYearly" } });
  assert.deepEqual(parseTodoInlineSyntax("续费域名 @每年", "2026-11-19").recurrence, { kind: "yearly" });
  assert.deepEqual(parseTodoInlineSyntax("renew domain @Yearly", "2026-11-19").recurrence, { kind: "yearly" });
});
