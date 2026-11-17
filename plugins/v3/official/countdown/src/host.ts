import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import {
  METHODS,
  TOPICS,
  isValidDateKey,
  sanitizeBackground,
  type CountdownItem,
  type CountdownSnapshot,
} from "./model.ts";

export const name = "@fuyu/countdown";
export const inject = ["clients"];

type StoredCountdown = {
  items: CountdownItem[];
  showInBar: boolean;
};

function readStored(file: string): StoredCountdown {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<StoredCountdown>;
    const items: CountdownItem[] = Array.isArray(raw.items)
      ? raw.items
          .filter(
            (entry): entry is CountdownItem =>
              Boolean(entry) &&
              typeof entry.id === "string" &&
              typeof entry.title === "string" &&
              entry.title.trim().length > 0 &&
              typeof entry.date === "string" &&
              isValidDateKey(entry.date),
          )
          .slice(0, 50)
          .map((entry) => ({
            id: entry.id,
            title: entry.title.trim().slice(0, 80),
            date: entry.date,
            pinned: entry.pinned === true,
            backgroundDataUrl: sanitizeBackground(entry.backgroundDataUrl),
          }))
      : [];
    return {
      items,
      showInBar: raw.showInBar !== false,
    };
  } catch {
    return { items: [], showInBar: true };
  }
}

export function apply(ctx: Context) {
  const stateFile = join(ctx.dataDir, "countdown.json");
  const stored = readStored(stateFile);

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function snapshot(): CountdownSnapshot {
    return {
      items: stored.items,
      showInBar: stored.showInBar,
      at: Date.now(),
    };
  }

  function publish() {
    ctx.clients.publish(TOPICS.snapshot, snapshot());
  }

  ctx.setInterval(publish, 60_000);

  ctx.clients.handle(METHODS.snapshot, () => snapshot());

  ctx.clients.handle(METHODS.add, (params?: { title?: string; date?: string; backgroundDataUrl?: string | null }) => {
    const title = typeof params?.title === "string" ? params.title.trim().slice(0, 80) : "";
    const date = typeof params?.date === "string" ? params.date.trim() : "";
    if (!title || !isValidDateKey(date)) return snapshot();
    const isFirst = stored.items.length === 0;
    stored.items.push({
      id: randomUUID(),
      title,
      date,
      pinned: isFirst,
      backgroundDataUrl: sanitizeBackground(params?.backgroundDataUrl),
    });
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.remove, (params?: { id?: string }) => {
    const id = typeof params?.id === "string" ? params.id : "";
    stored.items = stored.items.filter((item) => item.id !== id);
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.pin, (params?: { id?: string }) => {
    const id = typeof params?.id === "string" ? params.id : "";
    stored.items = stored.items.map((item) => ({
      ...item,
      pinned: item.id === id ? !item.pinned : false,
    }));
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.setBackground, (params?: { id?: string; backgroundDataUrl?: string | null }) => {
    const id = typeof params?.id === "string" ? params.id : "";
    const bg = sanitizeBackground(params?.backgroundDataUrl);
    stored.items = stored.items.map((item) => (item.id === id ? { ...item, backgroundDataUrl: bg } : item));
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.setShowInBar, (params?: { showInBar?: boolean }) => {
    stored.showInBar = params?.showInBar !== false;
    save();
    publish();
    return snapshot();
  });
}
