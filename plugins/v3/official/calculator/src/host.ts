import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { RATES_URL, parseRatesResponse } from "./currency.ts";
import { islandApi } from "./island-api.ts";
import { EMPTY_RATES, METHODS, PAGE_ID, PLUGIN_NAME, TOPICS, defaultPrefs, mergePrefs, normalizePrefs, openingTab, type Prefs, type RatesSnapshot } from "./model.ts";
import { COMMAND_TITLES } from "./text.ts";

export const name = PLUGIN_NAME;
export const inject = { clients: null, commands: null, island: { required: false } };

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readRates(file: string): RatesSnapshot {
  const raw = readJson(file) as Partial<RatesSnapshot> | null;
  if (!raw || typeof raw !== "object" || !raw.rates || typeof raw.rates !== "object") return { ...EMPTY_RATES };
  return {
    ...EMPTY_RATES,
    rates: raw.rates as Record<string, number>,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
    fetchedAt: typeof raw.fetchedAt === "number" ? raw.fetchedAt : null,
  };
}

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

export function apply(ctx: Context) {
  const prefsFile = join(ctx.dataDir, "prefs.json");
  const ratesFile = join(ctx.dataDir, "rates.json");
  const storedPrefs = readJson(prefsFile);
  let prefs: Prefs = storedPrefs ? normalizePrefs(storedPrefs) : defaultPrefs();
  let rates = readRates(ratesFile);
  let fetching: Promise<RatesSnapshot> | null = null;

  function write(file: string, data: unknown) {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    } catch {}
  }

  function publishRates() {
    ctx.clients.publish(TOPICS.rates, rates);
    return rates;
  }

  async function fetchRates(): Promise<RatesSnapshot> {
    rates = { ...rates, loading: true, error: null };
    publishRates();
    try {
      const response = await fetch(RATES_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = parseRatesResponse(await response.json());
      if (!parsed) throw new Error("bad response");
      rates = { base: "USD", rates: parsed.rates, updatedAt: parsed.updatedAt, fetchedAt: Date.now(), loading: false, error: null };
      write(ratesFile, { base: rates.base, rates: rates.rates, updatedAt: rates.updatedAt, fetchedAt: rates.fetchedAt });
    } catch (reason) {
      rates = { ...rates, loading: false, error: errorText(reason) };
    }
    return publishRates();
  }

  function refresh(force: boolean): Promise<RatesSnapshot> | RatesSnapshot {
    if (fetching) return fetching;
    const fresh = rates.fetchedAt !== null && Date.now() - rates.fetchedAt < prefs.settings.ratesHours * 3_600_000;
    if (fresh && !force) return rates;
    fetching = fetchRates().finally(() => {
      fetching = null;
    });
    return fetching;
  }

  ctx.clients.handle(METHODS.prefs, () => ({ ...prefs, tab: openingTab(prefs) }));
  ctx.clients.handle(METHODS.setSettings, (patch: unknown) => {
    prefs = mergePrefs(prefs, { settings: patch });
    write(prefsFile, prefs);
    ctx.clients.publish(TOPICS.settings, prefs.settings);
    return prefs;
  });
  ctx.clients.handle(METHODS.setPrefs, (patch: unknown) => {
    prefs = mergePrefs(prefs, patch);
    write(prefsFile, prefs);
    return prefs;
  });
  ctx.clients.handle(METHODS.rates, () => {
    void refresh(false);
    return rates;
  });
  ctx.clients.handle(METHODS.refreshRates, () => refresh(true));

  const island = islandApi(ctx);
  if (island?.open) {
    const open = island.open.bind(island);
    ctx.commands.register("open", () => open(PAGE_ID), { title: COMMAND_TITLES.open });
  }
}
