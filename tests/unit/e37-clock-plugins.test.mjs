import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { review } from "../../packages/plugin-review/src/index.mjs";
import { messagesV1 } from "../../packages/plugin-services/src/index.mjs";
import {
  daysDelta,
  primaryCountdown,
  sanitizeBackground,
  sortCountdownItems,
} from "../../plugins/v3/official/countdown/src/model.ts";
import {
  minuteKey,
  nextScheduledAlarm,
  shouldFireAlarm,
} from "../../plugins/v3/official/alarm/src/model.ts";
import {
  formatZoneClock,
  isValidTimeZone,
  primaryCity,
} from "../../plugins/v3/official/world-clock/src/model.ts";

const OFFICIAL_ROOT = fileURLToPath(new URL("../../plugins/v3/official", import.meta.url));
const PLUGINS = [
  { folder: "countdown", id: "@fuyu/countdown" },
  { folder: "alarm", id: "@fuyu/alarm" },
  { folder: "world-clock", id: "@fuyu/world-clock" },
];

const scratch = mkdtempSync(join(tmpdir(), "fuyu-e37-clocks-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("E37 official plugins: check, pack, review, install, and run in host", async () => {
  const hostDir = join(scratch, "host-data");
  mkdirSync(hostDir, { recursive: true });

  for (const entry of PLUGINS) {
    const dir = join(OFFICIAL_ROOT, entry.folder);
    const checkResult = await check(dir, { official: true, allowExperimental: false });
    assert.equal(checkResult.ok, true, `${entry.id} check failed: ${JSON.stringify(checkResult.errors)}`);
    assert.equal(
      checkResult.warnings.filter((w) => w.code !== "review:first-release").length,
      0,
      `${entry.id} unexpected warnings: ${JSON.stringify(checkResult.warnings)}`,
    );

    const packed = await pack(dir, {
      official: true,
      allowExperimental: false,
      outDir: join(scratch, "dist", entry.folder),
      packDir: join(scratch, "packed"),
    });
    assert.equal(packed.manifest.name, entry.id);

    const report = review({ oldDir: null, newDir: dir, newBuilt: packed.outDir });
    assert.equal(report.findings.some((f) => f.tier === "red"), false, `${entry.id} red findings: ${JSON.stringify(report.findings)}`);

    const installed = installPackage(packed.file, {
      dir: hostDir,
      source: "market",
      official: true,
      expectedSha256: packed.sha256,
    });
    assert.equal(installed.id, entry.id);
  }

  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  try {
    const messagesProvider = host.ctx.services.provide(messagesV1, {
      sources: async () => ({ sources: [] }),
      notify: async () => ({ shown: true, receivedAt: Date.now() }),
      clear: async () => ({ ok: true }),
    });
    await host.settle();

    for (const entry of PLUGINS) {
      const state = host.status().find((p) => p.id === entry.id);
      assert.equal(state?.state, "running", `${entry.id} expected running, got ${JSON.stringify(state)}`);
      assert.equal(state?.source, "market");
    }

    await messagesProvider.dispose();
  } finally {
    await host.stop();
  }
});

test("E37 countdown, alarm, and world-clock domain models", () => {
  const refAt = new Date(2026, 10, 17, 9, 30, 0).getTime();
  assert.equal(daysDelta("2026-11-20", refAt), 3);
  assert.equal(daysDelta("2026-11-17", refAt), 0);
  assert.equal(daysDelta("2026-11-15", refAt), -2);

  const items = [
    { id: "past", title: "Launch", date: "2026-11-10", pinned: false, backgroundDataUrl: null },
    { id: "far", title: "New Year", date: "2027-01-01", pinned: false, backgroundDataUrl: null },
    { id: "near", title: "Release", date: "2026-11-19", pinned: false, backgroundDataUrl: null },
  ];
  assert.deepEqual(
    sortCountdownItems(items, refAt).map((i) => i.id),
    ["near", "far", "past"],
  );
  assert.equal(primaryCountdown(items, refAt)?.id, "near");
  assert.equal(sanitizeBackground("https://evil.example/bg.png"), null);
  assert.equal(sanitizeBackground("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");

  const currentMin = minuteKey(refAt);
  const alarm = {
    id: "a1",
    time: "09:30",
    label: "Standup",
    days: [currentMin.day],
    tone: "chime",
    enabled: true,
    lastFiredMinute: null,
  };
  assert.equal(shouldFireAlarm(alarm, refAt), true);
  assert.equal(shouldFireAlarm({ ...alarm, lastFiredMinute: currentMin.key }, refAt), false);
  assert.equal(shouldFireAlarm({ ...alarm, days: [(currentMin.day + 1) % 7] }, refAt), false);

  const next = nextScheduledAlarm(
    [
      { ...alarm, id: "later", time: "10:15", days: [] },
      { ...alarm, id: "tomorrow", time: "08:00", days: [] },
    ],
    refAt,
  );
  assert.equal(next?.alarm.id, "later");
  assert.equal(next?.minutesAway, 45);

  assert.equal(isValidTimeZone("Asia/Tokyo"), true);
  assert.equal(isValidTimeZone("Not/AZone"), false);
  const utcClock = formatZoneClock(Date.UTC(2026, 10, 17, 14, 5, 0), "UTC");
  assert.equal(utcClock.hhmm, "14:05");
  assert.equal(utcClock.isDaytime, true);
  assert.equal(
    primaryCity([
      { id: "1", timeZone: "UTC", labelZh: "UTC", labelEn: "UTC", shortCode: "UTC", pinned: false },
      { id: "2", timeZone: "Asia/Tokyo", labelZh: "东京", labelEn: "Tokyo", shortCode: "TYO", pinned: true },
    ])?.id,
    "2",
  );
});
