import type { CpuInfo } from "node:os";

interface Tick {
  idle: number;
  total: number;
}

export interface CpuReading {
  percent: number;
  cores: number[];
  model: string;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function tickOf(core: CpuInfo): Tick {
  const t = core.times;
  return { idle: t.idle, total: t.user + t.nice + t.sys + t.idle + t.irq };
}

export class CpuMeter {
  private prev: Tick[] | null = null;
  private cores: number[] = [];
  private percent = 0;

  read(infos: CpuInfo[]): CpuReading {
    const model = infos[0]?.model?.trim() ?? "";
    if (infos.length === 0) {
      this.prev = [];
      this.cores = [];
      this.percent = 0;
      return { percent: 0, cores: [], model };
    }
    const ticks = infos.map(tickOf);
    if (!this.prev || this.prev.length !== ticks.length) {
      this.prev = ticks;
      this.cores = ticks.map((t) => Math.round(t.total > 0 ? clampPercent(((t.total - t.idle) / t.total) * 100) : 0));
      const idle = ticks.reduce((sum, t) => sum + t.idle, 0);
      const total = ticks.reduce((sum, t) => sum + t.total, 0);
      this.percent = total > 0 ? round1(clampPercent(((total - idle) / total) * 100)) : 0;
      return { percent: this.percent, cores: this.cores, model };
    }
    let sumIdle = 0;
    let sumTotal = 0;
    const next = [...this.cores];
    for (let i = 0; i < ticks.length; i += 1) {
      const dTotal = ticks[i].total - this.prev[i].total;
      const dIdle = Math.max(0, ticks[i].idle - this.prev[i].idle);
      if (dTotal > 0) {
        next[i] = Math.round(clampPercent((Math.max(0, dTotal - dIdle) / dTotal) * 100));
        this.prev[i] = ticks[i];
        sumTotal += dTotal;
        sumIdle += dIdle;
      } else if (dTotal < 0) {
        this.prev[i] = ticks[i];
      }
    }
    this.cores = next;
    if (sumTotal > 0) this.percent = round1(clampPercent((Math.max(0, sumTotal - sumIdle) / sumTotal) * 100));
    return { percent: this.percent, cores: this.cores, model };
  }
}
