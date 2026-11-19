import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../../packages/plugin-cli/src/index.mjs";
import { effectiveDate, readItem } from "../../plugins/v3/official/countdown/src/days.ts";
import {
  DEFAULT_SETTINGS,
  MAX_ITEMS,
  METHODS,
  barItem,
  moveItem,
  normalizeSettings,
  normalizeStored,
  pageView,
  togglePin,
} from "../../plugins/v3/official/countdown/src/model.ts";
import { dueReminders, markReminded } from "../../plugins/v3/official/countdown/src/reminders.ts";
import { apply } from "../../plugins/v3/official/countdown/src/host.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/countdown", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-countdown-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime();
const item = (id, date, extra = {}) => ({ id, title: id, date, pinned: false, kind: "countdown", repeat: false, bgRev: null, ...extra });

test("countdown 1.0.0 data reads unchanged: items, backgrounds and the collapsed bar switch; new settings default", () => {
  const old = {
    showInBar: false,
    items: Array.from({ length: 60 }, (_, i) => ({
      id: `i${i}`,
      title: ` Event ${i} `,
      date: "2026-12-01",
      pinned: i === 3,
      backgroundDataUrl: i === 0 ? "data:image/png;base64,AAAA" : null,
    })),
  };
  const stored = normalizeStored(old);
  assert.equal(stored.items.length, 60, "items past 50 are no longer dropped");
  assert.equal(stored.showInBar, false);
  assert.equal(stored.items[0].title, "Event 0");
  assert.equal(stored.items[0].backgroundDataUrl, "data:image/png;base64,AAAA");
  assert.equal(stored.items[0].bgRev, 1);
  assert.equal(stored.items[1].bgRev, null);
  assert.equal(stored.items[3].pinned, true);
  assert.equal(stored.items[5].kind, "countdown");
  assert.equal(stored.items[5].repeat, false);
  const { showInBar: _a, ...rest } = stored;
  const { showInBar: _b, ...defaults } = DEFAULT_SETTINGS;
  assert.deepEqual({ ...defaults }, Object.fromEntries(Object.keys(defaults).map((key) => [key, rest[key]])));
  assert.equal(MAX_ITEMS >= 200, true);
});

test("countdown defaults: restrained island and bar, reminders on the day only", () => {
  assert.equal(DEFAULT_SETTINGS.pageRows, 5);
  assert.equal(DEFAULT_SETTINGS.showDate, false);
  assert.equal(DEFAULT_SETTINGS.pastMode, "elapsed");
  assert.equal(DEFAULT_SETTINGS.remindOnDay, true);
  assert.equal(DEFAULT_SETTINGS.remindAhead, false);
  assert.equal(DEFAULT_SETTINGS.showInBar, true);
  assert.equal(DEFAULT_SETTINGS.barTarget, "pinned");
  assert.equal(DEFAULT_SETTINGS.barStyle, "days");
  const patched = normalizeSettings({ pageRows: 4, aheadDays: 3, pastMode: "gone", barStyle: "icon", showDate: "yes" });
  assert.equal(patched.pageRows, 5);
  assert.equal(patched.aheadDays, 3);
  assert.equal(patched.pastMode, "elapsed");
  assert.equal(patched.barStyle, "icon");
  assert.equal(patched.showDate, false);
});

test("countdown readings: countdown, today, past, anniversary day N and yearly repeat", () => {
  const now = at(2026, 11, 19);
  assert.deepEqual(readItem(item("a", "2026-12-01"), now), { type: "left", days: 12 });
  assert.deepEqual(readItem(item("a", "2026-11-19"), now), { type: "today" });
  assert.deepEqual(readItem(item("a", "2026-11-16"), now), { type: "past", days: 3 });
  assert.deepEqual(readItem(item("a", "2026-11-19", { kind: "anniversary" }), now), { type: "day", n: 1 });
  assert.deepEqual(readItem(item("a", "2024-01-30", { kind: "anniversary" }), now), { type: "day", n: 1025 });
  assert.deepEqual(readItem(item("a", "2026-12-20", { kind: "anniversary" }), now), { type: "left", days: 31 });
  assert.deepEqual(readItem(item("b", "1990-11-25", { repeat: true }), now), { type: "left", days: 6 });
  assert.deepEqual(readItem(item("b", "1990-11-19", { repeat: true }), now), { type: "today" });
  assert.equal(effectiveDate({ date: "1990-03-01", repeat: true }, now), "2027-03-01");
  assert.equal(effectiveDate({ date: "2024-02-29", repeat: true }, now), "2027-02-28");
  assert.equal(effectiveDate({ date: "2026-12-31", repeat: true }, now), "2026-12-31");
});

test("countdown island page: pinned hero, row limit, past hidden or kept, manual order", () => {
  const now = at(2026, 11, 19);
  const items = [
    item("exam", "2026-12-19"),
    item("past", "2026-11-10"),
    item("birthday", "2026-12-01", { pinned: true }),
    item("spring", "2027-02-02"),
    item("together", "2024-01-30", { kind: "anniversary" }),
  ];
  const view = pageView(items, DEFAULT_SETTINGS, now);
  assert.equal(view.hero?.id, "birthday");
  assert.deepEqual(view.rows.map((i) => i.id), ["exam", "spring", "together", "past"]);
  assert.equal(view.hidden, 0);

  const short = pageView(items, { ...DEFAULT_SETTINGS, pageRows: 3 }, now);
  assert.equal(short.rows.length, 3);
  assert.equal(short.hidden, 1);
  assert.deepEqual(pageView(items, { ...DEFAULT_SETTINGS, pageRows: 0 }, now).rows, []);

  const hidden = pageView(items, { ...DEFAULT_SETTINGS, pastMode: "hide" }, now);
  assert.equal(hidden.rows.some((i) => i.id === "past"), false);

  const manual = pageView(items, { ...DEFAULT_SETTINGS, order: "manual" }, now);
  assert.deepEqual(manual.rows.map((i) => i.id), ["exam", "past", "spring", "together"]);

  assert.equal(barItem(items, DEFAULT_SETTINGS, now)?.id, "birthday");
  assert.equal(barItem(items, { ...DEFAULT_SETTINGS, barTarget: "nearest" }, now)?.id, "birthday");
  assert.equal(barItem(togglePin(items, "birthday"), DEFAULT_SETTINGS, now)?.id, "birthday");
  assert.equal(barItem([item("x", "2026-11-01", { pinned: true })], { ...DEFAULT_SETTINGS, pastMode: "hide" }, now), null);

  assert.deepEqual(moveItem(items, "spring", 0).map((i) => i.id), ["spring", "exam", "past", "birthday", "together"]);
  assert.deepEqual(togglePin(items, "exam").filter((i) => i.pinned).map((i) => i.id), ["exam"]);
});

test("countdown reminders: after 9:00, on the day and N days ahead, once a day", () => {
  const items = [item("today", "2026-11-19"), item("soon", "2026-11-22"), item("bday", "1990-11-20", { repeat: true })];
  const reminded = { day: "", ids: [] };
  assert.deepEqual(dueReminders(items, DEFAULT_SETTINGS, reminded, at(2026, 11, 19, 8)), []);
  const due = dueReminders(items, DEFAULT_SETTINGS, reminded, at(2026, 11, 19, 9));
  assert.deepEqual(due.map((d) => [d.item.id, d.type]), [["today", "day"]]);

  const ahead = { ...DEFAULT_SETTINGS, remindAhead: true, aheadDays: 1 };
  const next = dueReminders(items, ahead, reminded, at(2026, 11, 19, 10));
  assert.deepEqual(next.map((d) => [d.item.id, d.type, d.years]), [["today", "day", 0], ["bday", "ahead", 36]]);

  const marked = markReminded(reminded, ["today"], at(2026, 11, 19, 10));
  assert.deepEqual(dueReminders(items, DEFAULT_SETTINGS, marked, at(2026, 11, 19, 11)), []);
  assert.deepEqual(markReminded(marked, ["x"], at(2026, 11, 20, 10)), { day: "2026-11-20", ids: ["x"] });
  assert.deepEqual(dueReminders(items, { ...DEFAULT_SETTINGS, remindOnDay: false }, reminded, at(2026, 11, 19, 10)), []);
});

function fakeContext(dataDir, notices) {
  const handlers = new Map();
  const published = [];
  const ctx = {
    dataDir,
    clients: {
      handle: (method, fn) => handlers.set(method, fn),
      publish: (topic, payload) => published.push({ topic, payload }),
    },
    services: { get: () => ({ notify: async (notice) => notices.push(notice) }) },
    setTimeout: () => () => {},
    setInterval: () => () => {},
  };
  return { ctx, call: (method, params) => handlers.get(method)(params), published };
}

test("countdown host: backgrounds are fetched on demand, not broadcast; full list says so", () => {
  const dataDir = join(scratch, "host");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, "countdown.json"),
    JSON.stringify({ showInBar: true, items: [{ id: "a", title: "Trip", date: "2026-12-01", pinned: true, backgroundDataUrl: "data:image/png;base64,AAAA" }] }),
  );
  const { ctx, call, published } = fakeContext(dataDir, []);
  apply(ctx);

  const snap = call(METHODS.snapshot);
  assert.equal(snap.items[0].bgRev, 1);
  assert.equal("backgroundDataUrl" in snap.items[0], false);
  assert.equal(JSON.stringify(snap).includes("base64"), false);
  assert.deepEqual(call(METHODS.background, { id: "a" }), { dataUrl: "data:image/png;base64,AAAA" });

  const added = call(METHODS.add, { title: "Birthday", date: "1990-05-04", kind: "countdown", repeat: true });
  assert.equal(added.items.length, 2);
  assert.equal(added.items[1].repeat, true);
  assert.equal(published.every((entry) => !JSON.stringify(entry.payload).includes("base64")), true);

  const id = added.items[1].id;
  const updated = call(METHODS.update, { id, title: "Mom's birthday", kind: "anniversary" });
  assert.equal(updated.items[1].title, "Mom's birthday");
  assert.equal(updated.items[1].kind, "anniversary");
  assert.equal(updated.items[1].date, "1990-05-04");

  const cleared = call(METHODS.setBackground, { id: "a", backgroundDataUrl: null });
  assert.equal(cleared.items[0].bgRev, null);
  assert.throws(() => call(METHODS.setBackground, { id: "a", backgroundDataUrl: "https://example.com/x.png" }));

  call(METHODS.setSettings, { barStyle: "title", pageRows: 10 });
  const saved = JSON.parse(readFileSync(join(dataDir, "countdown.json"), "utf8"));
  assert.equal(saved.barStyle, "title");
  assert.equal(saved.pageRows, 10);
  assert.equal(saved.items.length, 2);

  for (let i = saved.items.length; i < MAX_ITEMS; i += 1) call(METHODS.add, { title: `E${i}`, date: "2027-01-01" });
  assert.throws(() => call(METHODS.add, { title: "One too many", date: "2027-01-01" }), /At most/);
});

test("countdown manifest: Day counter in English, same id, check passes", async () => {
  const manifest = JSON.parse(readFileSync(join(PLUGIN_DIR, "package.json"), "utf8"));
  assert.equal(manifest.name, "@fuyu/countdown");
  assert.equal(manifest.version, "1.1.0");
  assert.equal(manifest.fuyu.displayName.en, "Day counter");
  assert.equal(manifest.fuyu.displayName["zh-CN"], "倒数日");
  assert.equal(manifest.description, manifest.fuyu.description.en);
  const result = await check(PLUGIN_DIR, { official: true, allowExperimental: false });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const island = readFileSync(join(PLUGIN_DIR, "src/island.tsx"), "utf8");
  assert.match(island, /opens: PAGE_ID/);
  assert.match(island, /title: PAGE_TITLE/);
});
