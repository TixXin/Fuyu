import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1, remindersV1 } from "@fuyu/plugin-services";
import { currentLocale } from "./locale.ts";
import {
  MAX_ALARMS,
  METHODS,
  TOPICS,
  minuteKey,
  missedAlarms,
  normalizeAlarms,
  normalizeDraft,
  normalizeSnoozed,
  shouldFireAlarm,
  type AlarmItem,
  type AlarmSnapshot,
  type RingPayload,
  type RingingAlarm,
  type SnoozedAlarm,
} from "./model.ts";
import { normalizeSettings, settingsFromStored, type AlarmSettings } from "./settingsModel.ts";

export const name = "@fuyu/alarm";
export const inject = ["clients", "commands", "messages/v1"];

const CHIME_EVERY_MS = 3200;
const GAP_MS = 90_000;
const SEEN_SAVE_MS = 60_000;

type Stored = {
  alarms: AlarmItem[];
  settings: AlarmSettings;
  snoozed: SnoozedAlarm | null;
  lastSeenAt: number | null;
};

function readStored(file: string): Stored {
  let raw: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
  } catch {
    raw = null;
  }
  const settings = settingsFromStored(raw);
  return {
    alarms: normalizeAlarms(raw?.alarms, settings.defaultTone),
    settings,
    snoozed: normalizeSnoozed(raw?.snoozed),
    lastSeenAt: typeof raw?.lastSeenAt === "number" && Number.isFinite(raw.lastSeenAt) ? raw.lastSeenAt : null,
  };
}

const sortAlarms = (alarms: AlarmItem[]) => alarms.sort((a, b) => a.time.localeCompare(b.time));

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);
  const reminders = ctx.services.get(remindersV1);
  const stateFile = join(ctx.dataDir, "alarms.json");
  const stored = readStored(stateFile);
  const zh = currentLocale() === "zh-CN";

  let ringing: RingingAlarm | null = null;
  let lastChimeAt = 0;
  let lastTickAt = Date.now();
  let lastSeenSavedAt = 0;

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function snapshot(at = Date.now()): AlarmSnapshot {
    return { alarms: stored.alarms, ringing, snoozed: stored.snoozed, settings: stored.settings, at };
  }

  function publish(at = Date.now()) {
    ctx.clients.publish(TOPICS.snapshot, snapshot(at));
  }

  function ring(entry: RingingAlarm) {
    const payload: RingPayload = {
      ...entry,
      volume: stored.settings.volume,
      fadeIn: stored.settings.fadeIn,
      ringMs: stored.settings.ringSeconds * 1000,
    };
    ctx.clients.publish(TOPICS.ring, payload);
  }

  function titleOf(entry: { label: string; time: string }) {
    return entry.label || (zh ? `闹钟 ${entry.time}` : `Alarm ${entry.time}`);
  }

  async function announce(id: string, title: string, body: string, at: number) {
    await messages.notify({ source: name, pluginId: name, title, body, durationMs: 12_000 }).catch(() => {});
    await reminders
      .push({ id: `alarm-${id}-${at}`, source: name, icon: "bell", title, detail: body, snoozable: true })
      .catch(() => {});
  }

  function triggerAlarm(entry: { id: string; label: string; time: string; tone: RingingAlarm["tone"] }, at: number) {
    ringing = { ...entry, firedAt: at };
    lastChimeAt = at;
    publish(at);
    ring(ringing);
    void announce(entry.id, titleOf(entry), zh ? `时间到了（${entry.time}）` : `It is ${entry.time}`, at);
  }

  function afterOnce(alarm: AlarmItem) {
    if (alarm.days.length > 0) return;
    if (stored.settings.onceAfter === "delete") {
      stored.alarms = stored.alarms.filter((item) => item.id !== alarm.id);
    } else {
      alarm.enabled = false;
    }
  }

  function reportMissed(from: number, to: number) {
    if (!stored.settings.catchUp) return;
    const missed = missedAlarms(stored.alarms, from, to);
    if (missed.length === 0) return;
    for (const entry of missed) {
      entry.alarm.lastFiredMinute = entry.key;
      afterOnce(entry.alarm);
    }
    save();
    publish();
    const list = missed.map((entry) => `${entry.alarm.time}${entry.alarm.label ? ` ${entry.alarm.label}` : ""}`).join(zh ? "、" : ", ");
    const title = zh ? "错过的闹钟" : missed.length > 1 ? "Missed alarms" : "Missed alarm";
    void announce("missed", title, list, to);
  }

  function minuteStart(at: number) {
    return at - (at % 60_000) - 1;
  }

  function startup() {
    const at = Date.now();
    if (stored.lastSeenAt !== null) reportMissed(stored.lastSeenAt, minuteStart(at));
    if (stored.snoozed && stored.snoozed.dueAt <= at) {
      const due = stored.snoozed;
      stored.snoozed = null;
      save();
      if (stored.settings.catchUp) {
        void announce("missed", zh ? "错过的闹钟" : "Missed alarm", `${due.alarm.time}${due.alarm.label ? ` ${due.alarm.label}` : ""}`, at);
      }
    }
  }

  function tick() {
    const at = Date.now();
    if (at - lastTickAt > GAP_MS) reportMissed(lastTickAt, minuteStart(at));
    lastTickAt = at;
    if (at - lastSeenSavedAt >= SEEN_SAVE_MS) {
      lastSeenSavedAt = at;
      stored.lastSeenAt = at;
      save();
    }

    if (ringing) {
      if (at - ringing.firedAt >= stored.settings.ringSeconds * 1000) {
        ringing = null;
        publish(at);
      } else if (at - lastChimeAt >= CHIME_EVERY_MS) {
        lastChimeAt = at;
        ring(ringing);
      }
    }

    if (stored.snoozed && at >= stored.snoozed.dueAt) {
      const due = stored.snoozed.alarm;
      stored.snoozed = null;
      save();
      triggerAlarm({ id: due.id, label: due.label, time: due.time, tone: due.tone }, at);
      return;
    }

    const current = minuteKey(at);
    for (const alarm of stored.alarms) {
      if (!shouldFireAlarm(alarm, at)) continue;
      alarm.lastFiredMinute = current.key;
      const entry = { id: alarm.id, label: alarm.label, time: alarm.time, tone: alarm.tone };
      afterOnce(alarm);
      save();
      triggerAlarm(entry, at);
      break;
    }
  }

  function dismiss() {
    ringing = null;
    stored.snoozed = null;
    save();
    publish();
    return snapshot();
  }

  function snooze() {
    if (ringing) {
      stored.snoozed = { dueAt: Date.now() + stored.settings.snoozeMinutes * 60_000, alarm: ringing };
      ringing = null;
      save();
      publish();
    }
    return snapshot();
  }

  const idOf = (params: unknown) =>
    params && typeof params === "object" && typeof (params as { id?: unknown }).id === "string" ? (params as { id: string }).id : "";

  function mutate(change: () => void) {
    change();
    save();
    publish();
    return snapshot();
  }

  startup();
  ctx.setInterval(tick, 1000);

  ctx.clients.handle(METHODS.snapshot, () => snapshot());

  ctx.clients.handle(METHODS.add, (params?: unknown) => {
    const draft = normalizeDraft(params, stored.settings.defaultTone);
    if (!draft || stored.alarms.length >= MAX_ALARMS) return snapshot();
    return mutate(() => {
      stored.alarms.push({ id: randomUUID(), ...draft, enabled: true, lastFiredMinute: null });
      sortAlarms(stored.alarms);
    });
  });

  ctx.clients.handle(METHODS.update, (params?: unknown) => {
    const id = idOf(params);
    const alarm = stored.alarms.find((item) => item.id === id);
    const draft = normalizeDraft(params, alarm?.tone ?? stored.settings.defaultTone);
    if (!alarm || !draft) return snapshot();
    return mutate(() => {
      const rescheduled = alarm.time !== draft.time || alarm.days.join() !== draft.days.join();
      Object.assign(alarm, draft);
      if (rescheduled) {
        alarm.enabled = true;
        alarm.lastFiredMinute = null;
      }
      sortAlarms(stored.alarms);
    });
  });

  ctx.clients.handle(METHODS.toggle, (params?: unknown) => {
    const id = idOf(params);
    return mutate(() => {
      for (const alarm of stored.alarms) {
        if (alarm.id !== id) continue;
        alarm.enabled = !alarm.enabled;
        if (alarm.enabled) alarm.lastFiredMinute = null;
      }
    });
  });

  ctx.clients.handle(METHODS.remove, (params?: unknown) => {
    const id = idOf(params);
    return mutate(() => {
      stored.alarms = stored.alarms.filter((item) => item.id !== id);
      if (ringing?.id === id) ringing = null;
      if (stored.snoozed?.alarm.id === id) stored.snoozed = null;
    });
  });

  ctx.clients.handle(METHODS.dismiss, dismiss);
  ctx.clients.handle(METHODS.snooze, snooze);

  ctx.clients.handle(METHODS.setSettings, (params?: unknown) =>
    mutate(() => {
      const patch = params && typeof params === "object" ? params : {};
      stored.settings = normalizeSettings({ ...stored.settings, ...patch }, stored.settings);
    }),
  );

  ctx.commands.register("dismiss", () => dismiss(), {
    title: { "zh-CN": "停止闹钟响铃", en: "Dismiss ringing alarm" },
  });
  ctx.commands.register("snooze", () => snooze(), {
    title: { "zh-CN": "闹钟贪睡", en: "Snooze ringing alarm" },
  });
}
