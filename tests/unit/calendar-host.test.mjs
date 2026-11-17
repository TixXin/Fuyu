import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { calendarV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { fromRust, refreshOf, serviceEvents, serviceSources } from "../../src/features/calendar/host/index.mjs";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function fakeRust(methods) {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const seen = [];
  const write = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    seen.push(message);
    if (message.id === undefined) return;
    const method = methods[message.method];
    if (!method) return write({ id: message.id, error: { code: "no-method", message: `Rust has no method ${message.method}` } });
    try {
      write({ id: message.id, result: await method(message.params) });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message, ...(error.data ? { data: error.data } : {}) } });
    }
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, asked: (method) => seen.filter((message) => message.method === method).map((message) => message.params) };
}

async function open(methods) {
  const dir = mkdtempSync(join(tmpdir(), "calendar-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust(methods);
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let calendar;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (calendar = ctx.services.get(calendarV1)) });
  return { host, rust, calendar };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(10);
  }
  return check();
}

const STANDUP = { uid: "a", title: "Standup", startMs: 10, endMs: 20, allDay: false, location: null, meetingLink: "https://meet.example/a", calendar: "Work" };

test("the calendar plugin provides calendar/v1 and reads the events from Rust", async () => {
  const { host, rust, calendar } = await open({
    "calendar.events": () => ({ events: [STANDUP], problems: [{ sourceId: "cal-1", reason: "calendar.linkExpired", message: "The link has expired." }], fetchedAt: 5, fromMs: 1, toMs: 30, sourceCount: 2 }),
  });
  assert.equal(host.status().find((plugin) => plugin.id === "calendar").state, "running");
  assert.deepEqual(await calendar.events({}), {
    events: [STANDUP],
    problems: [{ sourceId: "cal-1", reason: "calendar.linkExpired", message: "The link has expired." }],
    fetchedAt: 5,
    fromMs: 1,
    toMs: 30,
    sourceCount: 2,
  });
  await calendar.events({ refresh: true });
  assert.deepEqual(rust.asked("calendar.events"), [{ refresh: false }, { refresh: true }]);
  await assert.rejects(calendar.events({ refresh: "yes" }), { code: "bad-params" });
  await assert.rejects(calendar.events({ from: 1 }), { code: "bad-params" });
  assert.equal(rust.asked("calendar.events").length, 2);
});

test("calendar/v1 lists the calendars by name and host, never the account or the address", async () => {
  const { rust, calendar } = await open({
    "calendar.sources": () => ({ sources: [{ id: "cal-1", kind: "caldav", name: "Work", host: "dav.example", extra: "dropped" }] }),
  });
  assert.deepEqual(await calendar.sources(), { sources: [{ id: "cal-1", kind: "caldav", name: "Work", host: "dav.example" }] });
  assert.deepEqual(rust.asked("calendar.sources"), [null]);
  const fromWindow = serviceSources([{ id: "cal-2", kind: "ics", name: "Holidays", url: "", host: "calendars.example", username: "" }]);
  assert.deepEqual(fromWindow, { sources: [{ id: "cal-2", kind: "ics", name: "Holidays", host: "calendars.example" }] });
});

test("a Rust failure keeps its reason, and a stopped calendar is not-ready", async () => {
  const { host, calendar } = await open({
    "calendar.events": () => {
      throw Object.assign(new Error("Something went wrong inside the island."), { code: "internal" });
    },
  });
  await assert.rejects(calendar.events({}), (error) => error.code === "failed" && error.data.reason === "internal");
  [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "calendar").update({ disabled: true });
  assert.ok(await until(() => !host.services().some((service) => service.name === "calendar/v1")));
  await assert.rejects(calendar.events({}), { code: "not-ready" });
});

test("the window's snapshot and the host's answer turn into the same shape", () => {
  const fromWindow = serviceEvents({
    events: [{ ...STANDUP, extra: true }, { title: "no uid" }],
    problems: [{ sourceId: "cal-1", message: { code: "calendar.unreachable", message: "Could not reach the calendar.", detail: "dns" } }, { sourceId: "cal-2", message: "plain" }],
    fetchedAt: 5,
    fromMs: 1,
    toMs: 30,
    sourceCount: 2,
  });
  assert.deepEqual(fromWindow.events, [STANDUP]);
  assert.deepEqual(fromWindow.problems, [
    { sourceId: "cal-1", reason: "calendar.unreachable", message: "Could not reach the calendar." },
    { sourceId: "cal-2", reason: "failed", message: "plain" },
  ]);
  assert.deepEqual(serviceEvents(null), { events: [], problems: [], fetchedAt: 0, fromMs: 0, toMs: 0, sourceCount: 0 });
  assert.equal(refreshOf(undefined), false);
  assert.equal(refreshOf({ refresh: true }), true);
  assert.equal(fromRust({ code: "timeout", message: "late" }).code, "timeout");
  assert.equal(fromRust({ code: "inactive", message: "gone" }).code, "peer-gone");
});

test("plugins can register custom calendar sources, merge events and isolate per-source errors", async () => {
  const { host, calendar } = await open({
    "calendar.events": () => ({ events: [STANDUP], problems: [], fetchedAt: 5, fromMs: 1, toMs: 100, sourceCount: 1 }),
    "calendar.sources": () => ({ sources: [{ id: "cal-1", kind: "caldav", name: "Work", host: "dav.example" }] }),
  });
  let changes = 0;
  const offChanged = calendar.on("changed", () => {
    changes += 1;
  });
  const pluginFiber = await host.ctx.plugin({
    name: "feishu-calendar",
    inject: ["calendar.sources"],
    apply(ctx) {
      ctx.calendarSources.register({
        id: "feishu",
        name: "飞书日历",
        host: "feishu.cn",
        events: ({ refresh }) => [
          { uid: "b", title: refresh ? "Refreshed Sync" : "Feishu Sync", startMs: 5, endMs: 15, allDay: false, location: "Room 1", meetingLink: null },
          { uid: "a", title: "Duplicate Standup", startMs: 10, endMs: 20, allDay: false },
        ],
      });
      ctx.calendarSources.register({
        id: "broken-source",
        name: "Broken",
        events: () => {
          throw Object.assign(new Error("token expired"), { code: "calendar.authFailed" });
        },
      });
      assert.throws(
        () => ctx.calendarSources.register({ id: "feishu", name: "Dup", events: () => [] }),
        { code: "conflict" },
      );
    },
  });
  assert.ok(await until(() => changes >= 1));
  const sources = await calendar.sources();
  assert.deepEqual(sources, {
    sources: [
      { id: "cal-1", kind: "caldav", name: "Work", host: "dav.example" },
      { id: "feishu", kind: "plugin", name: "飞书日历", host: "feishu.cn" },
      { id: "broken-source", kind: "plugin", name: "Broken", host: "broken-source" },
    ],
  });
  const merged = await calendar.events({ refresh: true });
  assert.equal(merged.sourceCount, 3);
  assert.deepEqual(merged.events.map((item) => [item.uid, item.title, item.calendar]), [
    ["b", "Refreshed Sync", "飞书日历"],
    ["a", "Standup", "Work"],
  ]);
  assert.deepEqual(merged.problems, [
    { sourceId: "broken-source", reason: "calendar.authFailed", message: "token expired" },
  ]);

  await pluginFiber.dispose();
  assert.ok(await until(() => changes >= 2));
  assert.deepEqual(await calendar.sources(), {
    sources: [{ id: "cal-1", kind: "caldav", name: "Work", host: "dav.example" }],
  });
  await offChanged();
});

test("when the built-in calendar plugin is disabled, another plugin can replace calendar/v1", async () => {
  const { host, calendar } = await open({});
  [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "calendar").update({ disabled: true });
  assert.ok(await until(() => !host.services().some((service) => service.name === "calendar/v1")));
  const replacement = await host.ctx.plugin({
    name: "custom-calendar",
    apply(ctx) {
      ctx.services.provide(calendarV1, {
        events: () => ({ events: [STANDUP], problems: [], fetchedAt: 99, fromMs: 1, toMs: 50, sourceCount: 1 }),
        sources: () => ({ sources: [{ id: "custom", kind: "plugin", name: "Custom", host: "localhost" }] }),
      });
    },
  });
  assert.equal((await calendar.events({})).fetchedAt, 99);
  await replacement.dispose();
});
