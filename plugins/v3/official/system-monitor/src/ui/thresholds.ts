export type Level = "normal" | "warm" | "hot";

export interface Threshold {
  warm: number;
  hot: number;
}

export const THRESHOLDS = {
  cpu: { warm: 70, hot: 90 },
  memory: { warm: 80, hot: 92 },
  cpuTemperature: { warm: 75, hot: 90 },
  gpuTemperature: { warm: 75, hot: 87 },
  gpu: { warm: 70, hot: 90 },
} satisfies Record<string, Threshold>;

export function levelOf(value: number | null | undefined, threshold: Threshold): Level {
  if (value === null || value === undefined || !Number.isFinite(value)) return "normal";
  if (value >= threshold.hot) return "hot";
  if (value >= threshold.warm) return "warm";
  return "normal";
}

export function clampPercent(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
