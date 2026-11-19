import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import {
  MAX_CITIES,
  METHODS,
  TOPICS,
  deriveNames,
  focusCity,
  isValidTimeZone,
  moveCity,
  normalizeSettings,
  normalizeStored,
  renameCity,
  type StoredWorldClock,
  type WorldClockSettings,
  type WorldClockSnapshot,
} from "./model.ts";

export const name = "@fuyu/world-clock";
export const inject = ["clients"];

type AddParams = { timeZone?: string; labelZh?: string; labelEn?: string; shortCode?: string };

function readStored(file: string): StoredWorldClock {
  try {
    return normalizeStored(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return normalizeStored(null);
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function apply(ctx: Context) {
  const stateFile = join(ctx.dataDir, "world-clock.json");
  let stored = readStored(stateFile);

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function settings(): WorldClockSettings {
    const { cities: _cities, ...rest } = stored;
    return rest;
  }

  function snapshot(): WorldClockSnapshot {
    return { cities: stored.cities, settings: settings(), at: Date.now() };
  }

  function commit(): WorldClockSnapshot {
    save();
    const next = snapshot();
    ctx.clients.publish(TOPICS.snapshot, next);
    return next;
  }

  const idOf = (params: unknown) => {
    const id = (params as { id?: unknown } | undefined)?.id;
    return typeof id === "string" ? id : "";
  };

  ctx.clients.handle(METHODS.snapshot, () => snapshot());

  ctx.clients.handle(METHODS.add, (params?: AddParams) => {
    const timeZone = text(params?.timeZone, 64);
    if (!isValidTimeZone(timeZone)) throw new Error(`Invalid timeZone: ${timeZone}`);
    const derived = deriveNames(timeZone);
    const labelZh = text(params?.labelZh, 24) || derived.labelZh;
    const labelEn = text(params?.labelEn, 24) || derived.labelEn;
    const shortCode = text(params?.shortCode, 4).toUpperCase() || derived.shortCode;
    if (stored.cities.some((city) => city.timeZone === timeZone && city.labelEn === labelEn)) return snapshot();
    if (stored.cities.length >= MAX_CITIES) throw new Error(`At most ${MAX_CITIES} cities`);
    stored.cities = [
      ...stored.cities,
      { id: randomUUID(), timeZone, labelZh, labelEn, shortCode, pinned: stored.cities.length === 0 },
    ];
    return commit();
  });

  ctx.clients.handle(METHODS.remove, (params?: { id?: string }) => {
    const id = idOf(params);
    stored.cities = stored.cities.filter((city) => city.id !== id);
    return commit();
  });

  ctx.clients.handle(METHODS.focus, (params?: { id?: string }) => {
    stored.cities = focusCity(stored.cities, idOf(params));
    return commit();
  });

  ctx.clients.handle(METHODS.move, (params?: { id?: string; to?: number }) => {
    stored.cities = moveCity(stored.cities, idOf(params), Number(params?.to));
    return commit();
  });

  ctx.clients.handle(METHODS.rename, (params?: { id?: string; name?: string }) => {
    stored.cities = renameCity(stored.cities, idOf(params), params?.name);
    return commit();
  });

  ctx.clients.handle(METHODS.setSettings, (params?: Partial<WorldClockSettings>) => {
    stored = { ...normalizeSettings(params, settings()), cities: stored.cities };
    return commit();
  });
}
