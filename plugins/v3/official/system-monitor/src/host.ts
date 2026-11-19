import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, freemem, hostname, platform, totalmem, uptime } from "node:os";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import {
  DEFAULT_CONFIG,
  METHODS,
  TOPICS,
  type Locale,
  type MonitorConfig,
  type MonitorState,
  type Platform,
  type ProgramIcons,
} from "./protocol.ts";
import { mergeConfig, normalizeLocale, parseConfigFile } from "./host/config.ts";
import { CpuMeter } from "./host/cpu.ts";
import { nodeExec, type Exec } from "./host/exec.ts";
import { createMacSource } from "./host/mac/source.ts";
import { Scheduler } from "./host/scheduler.ts";
import { unsupportedSource, type Source } from "./host/source.ts";
import { PowerShellHelper } from "./host/win/helper.ts";
import { createWindowsSource } from "./host/win/source.ts";

export const name = "@fuyu/system-monitor";
export const inject = ["clients"];

const CONFIG_FILE = "config.json";

function loadConfig(dir: string): MonitorConfig {
  const file = join(dir, CONFIG_FILE);
  if (!existsSync(file)) return { ...DEFAULT_CONFIG };
  try {
    return parseConfigFile(readFileSync(file, "utf8"));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(dir: string, config: MonitorConfig): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function currentPlatform(): Platform {
  const value = platform();
  if (value === "win32") return "windows";
  if (value === "darwin") return "macos";
  return "other";
}

export function createSource(ctx: Context, exec: Exec, kind: Platform): Source {
  const cores = () => Math.max(1, cpus().length);
  if (kind === "macos") return createMacSource(exec, cores);
  if (kind === "windows") {
    const helper = new PowerShellHelper({
      exec,
      now: Date.now,
      after: (callback, ms) => ctx.setTimeout(callback, ms),
    });
    return createWindowsSource({ exec, helper, now: Date.now, cores });
  }
  return unsupportedSource(kind);
}

export function apply(ctx: Context) {
  let config = loadConfig(ctx.dataDir);
  const meter = new CpuMeter();
  const source = createSource(ctx, nodeExec, currentPlatform());
  let disposed = false;

  const scheduler = new Scheduler({
    source,
    config,
    now: Date.now,
    every: (callback, ms) => ctx.setInterval(callback, ms),
    readCpu: () => meter.read(cpus()),
    readMemory: () => ({ totalBytes: totalmem(), freeBytes: freemem() }),
    info: () => ({ uptimeSec: Math.max(0, Math.floor(uptime())), hostname: hostname(), arch: arch() }),
    publish: () => {
      if (!disposed) publish();
    },
  });

  ctx.effect(() => () => {
    disposed = true;
    scheduler.stop();
    source.dispose();
  }, "system-monitor source");

  const snapshot = (): MonitorState => ({
    config,
    platform: source.platform,
    features: scheduler.features,
    sample: scheduler.sample,
    sampling: scheduler.sampling,
    updatedAt: Date.now(),
  });

  function publish() {
    ctx.clients.publish(TOPICS.state, snapshot());
  }

  function updateConfig(next: MonitorConfig) {
    const changed = JSON.stringify(next) !== JSON.stringify(config);
    config = next;
    if (changed) saveConfig(ctx.dataDir, config);
    scheduler.setConfig(config);
  }

  function takeLocale(locale: unknown) {
    if (locale && normalizeLocale(locale) !== config.locale) {
      updateConfig({ ...config, locale: normalizeLocale(locale) });
    }
  }

  scheduler.sync();
  void scheduler.tick(true);

  ctx.clients.handle(METHODS.getState, async (params?: { locale?: Locale }) => {
    takeLocale(params?.locale);
    if (!scheduler.sample) await scheduler.tick(true);
    return snapshot();
  });

  ctx.clients.handle(
    METHODS.watchPage,
    async (params?: { viewerId?: string; active?: boolean; locale?: Locale }) => {
      const id = typeof params?.viewerId === "string" ? params.viewerId.trim() : "";
      takeLocale(params?.locale);
      if (id) scheduler.watch(id, params?.active === true);
      if (params?.active) await scheduler.tick(true);
      publish();
      return snapshot();
    },
  );

  ctx.clients.handle(METHODS.setConfig, async (params?: Partial<MonitorConfig>) => {
    updateConfig(mergeConfig(config, params));
    await scheduler.tick(true);
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.refresh, async (params?: { locale?: Locale }) => {
    takeLocale(params?.locale);
    await scheduler.tick(true);
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.getHistory, async () => scheduler.historySnapshot());

  ctx.clients.handle(METHODS.getProgramIcons, async (params?: { names?: unknown }): Promise<ProgramIcons> => {
    const names = Array.isArray(params?.names) ? params.names.filter((item): item is string => typeof item === "string") : [];
    return { icons: await source.programIcons(names) };
  });

  ctx.clients.handle(METHODS.openTaskManager, async () => {
    await source.openTaskManager();
    return { ok: true };
  });
}
