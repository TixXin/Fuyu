import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import {
  DEFAULT_CITIES,
  METHODS,
  PRESET_CITIES,
  TOPICS,
  isValidTimeZone,
  type WorldCity,
  type WorldClockSnapshot,
} from "./model.ts";

export const name = "@fuyu/world-clock";
export const inject = ["clients"];

type StoredWorldClock = {
  cities: WorldCity[];
  showInBar: boolean;
};

function deriveNames(timeZone: string): { labelZh: string; labelEn: string; shortCode: string } {
  const preset = PRESET_CITIES.find((item) => item.timeZone === timeZone);
  if (preset) return { labelZh: preset.labelZh, labelEn: preset.labelEn, shortCode: preset.shortCode };
  const tail = (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
  const code = tail.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CLK";
  return { labelZh: tail, labelEn: tail, shortCode: code };
}

function readStored(file: string): StoredWorldClock {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<StoredWorldClock>;
    if (!Array.isArray(raw.cities)) {
      return { cities: [...DEFAULT_CITIES], showInBar: raw.showInBar !== false };
    }
    const cities: WorldCity[] = raw.cities
      .filter((item): item is WorldCity => Boolean(item) && typeof item.id === "string" && typeof item.timeZone === "string" && isValidTimeZone(item.timeZone))
      .slice(0, 24)
      .map((item) => {
        const fallback = deriveNames(item.timeZone);
        return {
          id: item.id,
          timeZone: item.timeZone,
          labelZh: typeof item.labelZh === "string" && item.labelZh.trim() ? item.labelZh.trim() : fallback.labelZh,
          labelEn: typeof item.labelEn === "string" && item.labelEn.trim() ? item.labelEn.trim() : fallback.labelEn,
          shortCode: typeof item.shortCode === "string" && item.shortCode.trim() ? item.shortCode.trim().slice(0, 4) : fallback.shortCode,
          pinned: item.pinned === true,
        };
      });
    return {
      cities,
      showInBar: raw.showInBar !== false,
    };
  } catch {
    return { cities: [...DEFAULT_CITIES], showInBar: true };
  }
}

export function apply(ctx: Context) {
  const stateFile = join(ctx.dataDir, "world-clock.json");
  const stored = readStored(stateFile);

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function snapshot(): WorldClockSnapshot {
    return {
      cities: stored.cities,
      showInBar: stored.showInBar,
      at: Date.now(),
    };
  }

  function publish() {
    ctx.clients.publish(TOPICS.snapshot, snapshot());
  }

  ctx.setInterval(publish, 15_000);

  ctx.clients.handle(METHODS.snapshot, () => snapshot());

  ctx.clients.handle(METHODS.add, (params?: { timeZone?: string }) => {
    const timeZone = typeof params?.timeZone === "string" ? params.timeZone.trim() : "";
    if (!isValidTimeZone(timeZone)) {
      throw new Error(`Invalid timeZone: ${timeZone}`);
    }
    if (stored.cities.some((item) => item.timeZone === timeZone)) {
      return snapshot();
    }
    const names = deriveNames(timeZone);
    stored.cities.push({
      id: randomUUID(),
      timeZone,
      ...names,
      pinned: stored.cities.length === 0,
    });
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.remove, (params?: { id?: string }) => {
    const id = typeof params?.id === "string" ? params.id : "";
    stored.cities = stored.cities.filter((item) => item.id !== id);
    save();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.pin, (params?: { id?: string }) => {
    const id = typeof params?.id === "string" ? params.id : "";
    stored.cities = stored.cities.map((item) => ({
      ...item,
      pinned: item.id === id ? !item.pinned : false,
    }));
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
