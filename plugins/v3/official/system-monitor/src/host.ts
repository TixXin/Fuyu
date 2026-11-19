import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, freemem, hostname, platform, totalmem, uptime } from "node:os";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import {
  DEFAULT_CONFIG,
  METHODS,
  TOPICS,
  featuresFor,
  type Locale,
  type MonitorConfig,
  type MonitorSample,
  type MonitorState,
  type Platform,
} from "./protocol.ts";
import { mergeConfig, normalizeLocale, parseConfigFile } from "./host/config.ts";

export const name = "@fuyu/system-monitor";
export const inject = ["clients"];

const CONFIG_FILE = "config.json";

interface CpuTick {
  idle: number;
  total: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function loadConfig(dir: string): MonitorConfig {
  const file = join(dir, CONFIG_FILE);
  if (!existsSync(file)) return { ...DEFAULT_CONFIG };
  try {
    return parseConfigFile(readFileSync(file, "utf8"));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

const PLATFORM: Platform =
  platform() === "win32" ? "windows" : platform() === "darwin" ? "macos" : "other";

function saveConfig(dir: string, config: MonitorConfig): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function apply(ctx: Context) {
  let config = loadConfig(ctx.dataDir);
  let prevTicks: CpuTick[] | null = null;
  let lastCores: number[] = [];
  let lastCpu = 0;
  let latestSample: MonitorSample | null = null;
  const viewers = new Set<string>();
  let stopTimer: (() => Promise<void>) | null = null;
  let timerInterval = 0;

  function readSample(): MonitorSample {
    const rawCpus = cpus();
    if (rawCpus.length === 0) {
      prevTicks = [];
      lastCores = [];
      lastCpu = 0;
    } else if (!prevTicks || prevTicks.length !== rawCpus.length) {
      let sumIdle = 0;
      let sumTotal = 0;
      prevTicks = [];
      lastCores = [];
      for (const core of rawCpus) {
        const t = core.times;
        const total = t.user + t.nice + t.sys + t.idle + t.irq;
        const idle = t.idle;
        prevTicks.push({ idle, total });
        sumIdle += idle;
        sumTotal += total;
        const pct = total > 0 ? clampPercent(((total - idle) / total) * 100) : 0;
        lastCores.push(Math.round(pct));
      }
      lastCpu = sumTotal > 0 ? round1(clampPercent(((sumTotal - sumIdle) / sumTotal) * 100)) : 0;
    } else {
      let sumDeltaIdle = 0;
      let sumDeltaTotal = 0;
      const nextCores = [...lastCores];
      for (let i = 0; i < rawCpus.length; i += 1) {
        const t = rawCpus[i].times;
        const total = t.user + t.nice + t.sys + t.idle + t.irq;
        const idle = t.idle;
        const prev = prevTicks[i];
        const dTotal = total - prev.total;
        const dIdle = idle - prev.idle;
        if (dTotal > 0) {
          const busy = Math.max(0, dTotal - Math.max(0, dIdle));
          nextCores[i] = Math.round(clampPercent((busy / dTotal) * 100));
          prevTicks[i] = { idle, total };
          sumDeltaTotal += dTotal;
          sumDeltaIdle += Math.max(0, dIdle);
        } else if (dTotal < 0) {
          prevTicks[i] = { idle, total };
        }
      }
      lastCores = nextCores;
      if (sumDeltaTotal > 0) {
        const busyAll = Math.max(0, sumDeltaTotal - sumDeltaIdle);
        lastCpu = round1(clampPercent((busyAll / sumDeltaTotal) * 100));
      }
    }

    const memTotal = Math.max(0, totalmem());
    const memFree = Math.max(0, Math.min(memTotal, freemem()));
    const memUsed = Math.max(0, memTotal - memFree);
    const memPct = memTotal > 0 ? round1(clampPercent((memUsed / memTotal) * 100)) : 0;

    const later = { status: "pending" } as const;
    latestSample = {
      takenAt: Date.now(),
      platform: PLATFORM,
      cpuTemperatureC: later,
      gpu: later,
      network: later,
      battery: later,
      programs: later,
      cpuPercent: lastCpu,
      cores: lastCores,
      cpuModel: rawCpus[0]?.model?.trim() ?? "",
      memoryUsedBytes: memUsed,
      memoryTotalBytes: memTotal,
      memoryPercent: memPct,
      uptimeSec: Math.max(0, Math.floor(uptime())),
      hostname: hostname(),
      arch: arch(),
    };
    return latestSample;
  }

  const shouldSample = (): boolean =>
    viewers.size > 0 || (config.showOnBar && (config.barCpu || config.barMemory));

  const snapshot = (): MonitorState => ({
    config,
    platform: PLATFORM,
    features: featuresFor(PLATFORM),
    sample: latestSample ?? readSample(),
    sampling: stopTimer !== null,
    updatedAt: Date.now(),
  });

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());

  function syncSampler() {
    const active = shouldSample();
    if (!active) {
      if (stopTimer) {
        void stopTimer();
        stopTimer = null;
        timerInterval = 0;
      }
      return;
    }
    if (stopTimer && timerInterval === config.intervalMs) {
      return;
    }
    if (stopTimer) {
      void stopTimer();
      stopTimer = null;
    }
    timerInterval = config.intervalMs;
    stopTimer = ctx.setInterval(() => {
      readSample();
      publish();
    }, timerInterval);
  }

  readSample();
  syncSampler();

  ctx.clients.handle(METHODS.getState, async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      saveConfig(ctx.dataDir, config);
    }
    readSample();
    return snapshot();
  });

  ctx.clients.handle(
    METHODS.watchPage,
    async (params?: { viewerId?: string; active?: boolean; locale?: Locale }) => {
      const id = typeof params?.viewerId === "string" ? params.viewerId.trim() : "";
      if (id) {
        if (params?.active) viewers.add(id);
        else viewers.delete(id);
      }
      if (params?.locale && params.locale !== config.locale) {
        config = { ...config, locale: normalizeLocale(params.locale) };
        saveConfig(ctx.dataDir, config);
      }
      if (params?.active) {
        readSample();
      }
      syncSampler();
      publish();
      return snapshot();
    },
  );

  ctx.clients.handle(METHODS.setConfig, async (params?: Partial<MonitorConfig>) => {
    config = mergeConfig(config, params);
    saveConfig(ctx.dataDir, config);
    readSample();
    syncSampler();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.refresh, async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      saveConfig(ctx.dataDir, config);
    }
    readSample();
    publish();
    return snapshot();
  });
}
