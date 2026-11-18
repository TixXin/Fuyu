import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1, remindersV1 } from "@fuyu/plugin-services";
import {
  METHODS,
  TOPICS,
  isValidTime,
  minuteKey,
  normalizeDays,
  normalizeTone,
  shouldFireAlarm,
  type AlarmItem,
  type AlarmSnapshot,
  type AlarmTone,
  type RingingAlarm,
} from "./model.ts";

export const name = "@fuyu/alarm";
export const inject = ["clients", "messages/v1"];

const AUTO_SILENCE_MS = 30_000;
const SNOOZE_MS = 5 * 60_000;

type StoredAlarms = {
  alarms: AlarmItem[];
  defaultTone: AlarmTone;
  showInBar: boolean;
};

function isZhHost(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("zh");
  } catch {
    return true;
  }
}

function readStored(file: string): StoredAlarms {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<StoredAlarms>;
    const defaultTone = normalizeTone(raw.defaultTone, "chime");
    const alarms: AlarmItem[] = Array.isArray(raw.alarms)
      ? raw.alarms
          .filter((item): item is AlarmItem => Boolean(item) && typeof item.id === "string" && typeof item.time === "string" && isValidTime(item.time))
          .slice(0, 40)
          .map((item) => ({
            id: item.id,
            time: item.time,
            label: typeof item.label === "string" ? item.label.trim().slice(0, 60) : "",
            days: normalizeDays(item.days),
            tone: normalizeTone(item.tone, defaultTone),
            enabled: item.enabled !== false,
            lastFiredMinute: typeof item.lastFiredMinute === "string" ? item.lastFiredMinute : null,
          }))
      : [];
    return {
      alarms,
      defaultTone,
      showInBar: raw.showInBar !== false,
    };
  } catch {
    return { alarms: [], defaultTone: "chime", showInBar: true };
  }
}

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);
  const reminders = ctx.services.get(remindersV1);
  const stateFile = join(ctx.dataDir, "alarms.json");
  const stored = readStored(stateFile);

  let ringing: RingingAlarm | null = null;
  let lastChimeAt = 0;
  let snoozed: { dueAt: number; alarm: RingingAlarm } | null = null;

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function snapshot(at = Date.now()): AlarmSnapshot {
    return {
      alarms: stored.alarms,
      ringing,
      defaultTone: stored.defaultTone,
      showInBar: stored.showInBar,
      at,
    };
  }

  function publish(at = Date.now()) {
    ctx.clients.publish(TOPICS.snapshot, snapshot(at));
  }

  async function triggerAlarm(entry: { id: string; label: string; time: string; tone: AlarmTone }, at: number) {
    ringing = { ...entry, firedAt: at };
    lastChimeAt = at;
    publish(at);
    ctx.clients.publish(TOPICS.ring, ringing);

    const zh = isZhHost();
    const title = entry.label || (zh ? `闹钟 ${entry.time}` : `Alarm ${entry.time}`);
    const body = zh ? `时间到了（${entry.time}）` : `It is ${entry.time}`;
    await messages
      .notify({
        source: name,
        pluginId: name,
        title,
        body,
        durationMs: 12_000,
      })
      .catch(() => {});
    await reminders
      .push({
        id: `alarm-${entry.id}-${at}`,
        source: name,
        icon: "bell",
        title,
        detail: entry.time,
        snoozable: true,
      })
      .catch(() => {});
  }

  function tick() {
    const at = Date.now();
    if (ringing) {
      if (at - ringing.firedAt >= AUTO_SILENCE_MS) {
        ringing = null;
        publish(at);
      } else if (at - lastChimeAt >= 3200) {
        lastChimeAt = at;
        ctx.clients.publish(TOPICS.ring, ringing);
      }
    }

    if (snoozed && at >= snoozed.dueAt) {
      const due = snoozed.alarm;
      snoozed = null;
      void triggerAlarm({ id: due.id, label: due.label, time: due.time, tone: due.tone }, at);
      return;
    }

    const current = minuteKey(at);
    for (const alarm of stored.alarms) {
      if (!shouldFireAlarm(alarm, at)) continue;
      alarm.lastFiredMinute = current.key;
      if (alarm.days.length === 0) {
        alarm.enabled = false;
      }
      save();
      void triggerAlarm({ id: alarm.id, label: alarm.label, time: alarm.time, tone: alarm.tone }, at);
      break;
    }
  }

  ctx.setInterval(tick, 1000);

  ctx.clients.handle(METHODS.snapshot, () => snapshot());

  ctx.clients.handle(
    METHODS.add,
    (params?: { time?: string; label?: string; days?: number[]; tone?: AlarmTone }) => {
      const time = typeof params?.time === "string" ? params.time.trim() : "";
      if (!isValidTime(time)) return snapshot();
      stored.alarms.push({
        id: randomUUID(),
        time,
        label: typeof params?.label === "string" ? params.label.trim().slice(0, 60) : "",
        days: normalizeDays(params?.days),
        tone: normalizeTone(params?.tone, stored.defaultTone),
        enabled: true,
        lastFiredMinute: null,
      });
      stored.alarms.sort((a, b) => a.time.localeCompare(b.time));
      save();
      publish();
      return snapshot();
    },
  );

  ctx.clients.handle(METHODS.toggle, (params?: { id?: string }) => {
    const id = typeof params?.id === "string" ? params.id : "";
    for (const alarm of stored.alarms) {
      if (alarm.id === id) {
        alarm.enabled = !alarm.enabled;
        if (alarm.enabled) alarm.lastFiredMinute = null;
      }
    }
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.remove, (params?: { id?: string }) => {
    const id = typeof params?.id === "string" ? params.id : "";
    stored.alarms = stored.alarms.filter((item) => item.id !== id);
    if (ringing?.id === id) ringing = null;
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.dismiss, () => {
    ringing = null;
    snoozed = null;
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.snooze, () => {
    if (ringing) {
      snoozed = { dueAt: Date.now() + SNOOZE_MS, alarm: ringing };
      ringing = null;
      publish();
    }
    return snapshot();
  });

  ctx.clients.handle(METHODS.setSettings, (params?: { defaultTone?: AlarmTone; showInBar?: boolean }) => {
    if (params?.defaultTone !== undefined) stored.defaultTone = normalizeTone(params.defaultTone, stored.defaultTone);
    if (params?.showInBar !== undefined) stored.showInBar = Boolean(params.showInBar);
    save();
    publish();
    return snapshot();
  });
}
