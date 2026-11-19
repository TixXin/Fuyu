import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1 } from "@fuyu/plugin-services";
import {
  MAX_ITEMS,
  METHODS,
  TOPICS,
  applyDraft,
  cleanKind,
  cleanTitle,
  isValidDateKey,
  moveItem,
  normalizeSettings,
  normalizeStored,
  sanitizeBackground,
  toView,
  togglePin,
  type CountdownSettings,
  type CountdownSnapshot,
  type ItemDraft,
  type StoredCountdown,
} from "./model.ts";
import { dueReminders, markReminded, type DueReminder } from "./reminders.ts";
import { text } from "./text.ts";

export const name = "@fuyu/countdown";
export const inject = ["clients"];

function readStored(file: string): StoredCountdown {
  try {
    return normalizeStored(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return normalizeStored(null);
  }
}

function notice(due: DueReminder): { title: string; body: string } {
  const { item } = due;
  if (due.type === "ahead") return { title: text.remindAheadTitle(item.title, due.days), body: text.remindAheadBody(item.date) };
  const title = due.years > 0 ? text.remindTodayYears(item.title, due.years) : text.remindTodayTitle(item.title);
  return { title, body: text.remindTodayBody };
}

export function apply(ctx: Context) {
  const messages = ctx.services.get(messagesV1);
  const stateFile = join(ctx.dataDir, "countdown.json");
  let stored = readStored(stateFile);

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function settings(): CountdownSettings {
    const { items: _items, reminded: _reminded, ...rest } = stored;
    return rest;
  }

  function snapshot(): CountdownSnapshot {
    return { items: stored.items.map(toView), settings: settings(), at: Date.now() };
  }

  function commit(): CountdownSnapshot {
    save();
    const next = snapshot();
    ctx.clients.publish(TOPICS.snapshot, next);
    return next;
  }

  function quiet(id: string) {
    stored.reminded = markReminded(stored.reminded, [id], Date.now());
  }

  let reminding = false;
  async function remind() {
    if (reminding) return;
    reminding = true;
    try {
      const at = Date.now();
      for (const entry of dueReminders(stored.items.map(toView), settings(), stored.reminded, at)) {
        const sent = await messages
          .notify({ source: name, pluginId: name, ...notice(entry), durationMs: 10_000 })
          .then(() => true, () => false);
        if (!sent) break;
        stored.reminded = markReminded(stored.reminded, [entry.item.id], at);
        save();
      }
    } finally {
      reminding = false;
    }
  }

  const idOf = (params: unknown) => {
    const id = (params as { id?: unknown } | undefined)?.id;
    return typeof id === "string" ? id : "";
  };

  ctx.clients.handle(METHODS.snapshot, () => snapshot());

  ctx.clients.handle(METHODS.add, (params?: ItemDraft) => {
    const title = cleanTitle(params?.title);
    const date = typeof params?.date === "string" ? params.date.trim() : "";
    if (!title || !isValidDateKey(date)) throw new Error("Invalid title or date");
    if (stored.items.length >= MAX_ITEMS) throw new Error(`At most ${MAX_ITEMS} dates`);
    const id = randomUUID();
    stored.items = [
      ...stored.items,
      {
        id,
        title,
        date,
        pinned: stored.items.length === 0,
        kind: cleanKind(params?.kind),
        repeat: params?.repeat === true,
        bgRev: null,
        backgroundDataUrl: null,
      },
    ];
    quiet(id);
    return commit();
  });

  ctx.clients.handle(METHODS.update, (params?: ItemDraft & { id?: string }) => {
    const id = idOf(params);
    stored.items = stored.items.map((item) => (item.id === id ? applyDraft(item, params ?? {}) : item));
    quiet(id);
    return commit();
  });

  ctx.clients.handle(METHODS.remove, (params?: { id?: string }) => {
    const id = idOf(params);
    stored.items = stored.items.filter((item) => item.id !== id);
    return commit();
  });

  ctx.clients.handle(METHODS.pin, (params?: { id?: string }) => {
    stored.items = togglePin(stored.items, idOf(params));
    return commit();
  });

  ctx.clients.handle(METHODS.move, (params?: { id?: string; to?: number }) => {
    stored.items = moveItem(stored.items, idOf(params), Number(params?.to));
    return commit();
  });

  ctx.clients.handle(METHODS.setBackground, (params?: { id?: string; backgroundDataUrl?: string | null }) => {
    const id = idOf(params);
    const bg = sanitizeBackground(params?.backgroundDataUrl);
    if (params?.backgroundDataUrl && !bg) throw new Error("Background image is too large or not an image");
    stored.items = stored.items.map((item) =>
      item.id === id ? { ...item, backgroundDataUrl: bg, bgRev: bg ? Date.now() : null } : item,
    );
    return commit();
  });

  ctx.clients.handle(METHODS.background, (params?: { id?: string }) => {
    const id = idOf(params);
    return { dataUrl: stored.items.find((item) => item.id === id)?.backgroundDataUrl ?? null };
  });

  ctx.clients.handle(METHODS.setSettings, (params?: Partial<CountdownSettings>) => {
    stored = { ...normalizeSettings(params, settings()), items: stored.items, reminded: stored.reminded };
    return commit();
  });

  ctx.setTimeout(() => void remind(), 5_000);
  ctx.setInterval(() => void remind(), 60_000);
}
