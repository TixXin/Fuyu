import {
  BACKGROUND_INTERVAL_MS,
  BATTERY_INTERVAL_MS,
  GPU_INTERVAL_MS,
  PAGE_INTERVAL_MS,
  PROGRAMS_INTERVAL_MS,
  featuresFor,
  historyPoint,
  type BatteryReading,
  type GpuReading,
  type MonitorConfig,
  type MonitorFeatures,
  type MonitorHistory,
  type MonitorSample,
  type NetworkReading,
  type ProgramsReading,
  type Reading,
} from "../protocol.ts";
import type { CpuReading } from "./cpu.ts";
import { History } from "./history.ts";
import { PENDING, UNSUPPORTED, type Source } from "./source.ts";

const SLACK_MS = 100;

export interface SystemInfo {
  uptimeSec: number;
  hostname: string;
  arch: string;
}

export interface SchedulerDeps {
  source: Source;
  config: MonitorConfig;
  now(): number;
  every(callback: () => void, ms: number): () => void;
  readCpu(): CpuReading;
  readMemory(): { totalBytes: number; freeBytes: number };
  info(): SystemInfo;
  publish(sample: MonitorSample): void;
}

interface Readings {
  cpuTemperatureC: Reading<number>;
  gpu: Reading<GpuReading>;
  network: Reading<NetworkReading>;
  battery: Reading<BatteryReading>;
  programs: Reading<ProgramsReading>;
}

type Plan = { page: boolean; bar: boolean; background: boolean };

type Cadence = "gpu" | "programs" | "battery" | "bar" | "background";

export class Scheduler {
  readonly features: MonitorFeatures;
  readonly history = new History();
  sample: MonitorSample | null = null;
  private config: MonitorConfig;
  private readonly deps: SchedulerDeps;
  private readonly viewers = new Set<string>();
  private readings: Readings;
  private stopTimer: (() => void) | null = null;
  private period = 0;
  private running: Promise<MonitorSample | null> | null = null;
  private last: Record<Cadence, number> = { gpu: 0, programs: 0, battery: 0, bar: 0, background: 0 };

  constructor(deps: SchedulerDeps) {
    this.deps = deps;
    this.config = deps.config;
    this.features = featuresFor(deps.source.platform);
    this.readings = this.freshReadings();
  }

  get pageOpen(): boolean {
    return this.viewers.size > 0;
  }

  get sampling(): boolean {
    return this.stopTimer !== null;
  }

  get intervalMs(): number {
    return this.period;
  }

  barActive(config = this.config): boolean {
    if (!config.showOnBar) return false;
    return (
      config.barCpu ||
      config.barMemory ||
      (config.barCpuTemperature && this.features.cpuTemperature) ||
      (config.barGpuTemperature && this.features.gpuTemperature)
    );
  }

  setConfig(config: MonitorConfig): void {
    const hadExtras = this.backgroundExtras();
    this.config = config;
    if (hadExtras && !this.backgroundExtras() && !this.pageOpen) this.forgetNetwork();
    this.sync();
  }

  watch(viewerId: string, active: boolean): void {
    const wasOpen = this.pageOpen;
    if (active) this.viewers.add(viewerId);
    else this.viewers.delete(viewerId);
    if (wasOpen && !this.pageOpen) this.pageClosed();
    if (!wasOpen && this.pageOpen) this.last = { ...this.last, gpu: 0, programs: 0, battery: 0 };
    this.sync();
  }

  historySnapshot(): MonitorHistory {
    return this.history.snapshot(this.deps.now());
  }

  stop(): void {
    this.stopTimer?.();
    this.stopTimer = null;
    this.period = 0;
  }

  sync(): void {
    const period = this.wantedPeriod();
    if (period === this.period && (period === 0) === (this.stopTimer === null)) return;
    this.stop();
    if (period === 0) return;
    this.period = period;
    this.stopTimer = this.deps.every(() => {
      void this.tick();
    }, period);
  }

  tick(force = false): Promise<MonitorSample | null> {
    if (this.running) return this.running;
    const task = this.run(force).finally(() => {
      this.running = null;
    });
    this.running = task;
    return task;
  }

  private wantedPeriod(): number {
    if (this.pageOpen) return PAGE_INTERVAL_MS;
    if (this.barActive()) return Math.min(this.config.intervalMs, BACKGROUND_INTERVAL_MS);
    return BACKGROUND_INTERVAL_MS;
  }

  private backgroundExtras(): boolean {
    return this.config.backgroundHistory || this.source.cheapBackground;
  }

  private due(key: Cadence, now: number, every: number): boolean {
    return now - this.last[key] >= every - SLACK_MS;
  }

  private plan(now: number, force: boolean): Plan {
    const page = this.pageOpen;
    const bar = this.barActive() && (force || this.due("bar", now, this.config.intervalMs));
    const background = !page && (force || this.due("background", now, BACKGROUND_INTERVAL_MS));
    return { page, bar: bar || (force && !page), background };
  }

  private async run(force: boolean): Promise<MonitorSample | null> {
    const now = this.deps.now();
    const plan = this.plan(now, force);
    if (!plan.page && !plan.bar && !plan.background) return this.sample;
    if (plan.bar) this.last.bar = now;
    if (plan.background) this.last.background = now;
    const cpu = this.deps.readCpu();
    const { source } = this;
    const jobs: Promise<void>[] = [];
    const read = <K extends keyof Readings>(key: K, task: () => Promise<Readings[K]>) => {
      jobs.push(
        task().then(
          (value) => {
            this.readings[key] = value;
          },
          (error: unknown) => {
            this.readings[key] = { status: "error", message: error instanceof Error ? error.message : String(error) };
          },
        ),
      );
    };
    const memory = source.memoryUsedBytes().catch(() => null);
    const features = this.features;
    const config = this.config;
    if (plan.page) {
      if (features.network) read("network", () => source.network(now));
      if (features.cpuTemperature) read("cpuTemperatureC", () => source.cpuTemperature());
      if (features.gpu && this.due("gpu", now, GPU_INTERVAL_MS)) {
        this.last.gpu = now;
        read("gpu", () => source.gpu({ detail: true }));
      }
      if (features.programs && this.due("programs", now, PROGRAMS_INTERVAL_MS)) {
        this.last.programs = now;
        read("programs", () => source.programs(now));
      }
      if (features.battery && this.due("battery", now, BATTERY_INTERVAL_MS)) {
        this.last.battery = now;
        read("battery", () => source.battery());
      }
    } else {
      const barCpuTemperature = plan.bar && config.barCpuTemperature && features.cpuTemperature;
      const barGpuTemperature = plan.bar && config.barGpuTemperature && features.gpuTemperature;
      const extras = plan.background && this.backgroundExtras();
      if (extras && features.network) read("network", () => source.network(now));
      if (barCpuTemperature) read("cpuTemperatureC", () => source.cpuTemperature());
      if (features.gpu && (extras || barGpuTemperature) && this.due("gpu", now, GPU_INTERVAL_MS)) {
        this.last.gpu = now;
        read("gpu", () => source.gpu({ detail: false }));
      }
    }
    const usedFromSource = await memory;
    await Promise.all(jobs);
    const sample = this.buildSample(now, cpu, usedFromSource);
    this.sample = sample;
    if (plan.page || plan.background) this.history.add(historyPoint(sample));
    this.deps.publish(sample);
    return sample;
  }

  private get source(): Source {
    return this.deps.source;
  }

  private buildSample(now: number, cpu: CpuReading, usedFromSource: number | null): MonitorSample {
    const { totalBytes, freeBytes } = this.deps.readMemory();
    const total = Math.max(0, totalBytes);
    const used = Math.max(0, Math.min(total, usedFromSource ?? total - Math.max(0, freeBytes)));
    const info = this.deps.info();
    return {
      takenAt: now,
      platform: this.source.platform,
      cpuPercent: cpu.percent,
      cores: cpu.cores,
      cpuModel: cpu.model,
      memoryUsedBytes: used,
      memoryTotalBytes: total,
      memoryPercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
      uptimeSec: info.uptimeSec,
      hostname: info.hostname,
      arch: info.arch,
      ...this.readings,
    };
  }

  private freshReadings(): Readings {
    const f = this.features;
    return {
      cpuTemperatureC: f.cpuTemperature ? PENDING : UNSUPPORTED,
      gpu: f.gpu ? PENDING : UNSUPPORTED,
      network: f.network ? PENDING : UNSUPPORTED,
      battery: f.battery ? PENDING : UNSUPPORTED,
      programs: f.programs ? PENDING : UNSUPPORTED,
    };
  }

  private pageClosed(): void {
    this.source.resetPrograms();
    this.readings = this.freshReadings();
    if (!this.backgroundExtras()) this.forgetNetwork();
  }

  private forgetNetwork(): void {
    this.source.resetNetwork();
    this.readings.network = this.features.network ? PENDING : UNSUPPORTED;
  }
}
