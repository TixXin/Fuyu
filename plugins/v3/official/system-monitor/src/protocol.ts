export type Locale = "zh-CN" | "en";

export type Platform = "windows" | "macos" | "other";

export type Layout = "auto" | "single" | "double";

export type Reading<T> =
  | { status: "ok"; value: T }
  | { status: "pending" }
  | { status: "unsupported" }
  | { status: "absent" }
  | { status: "error"; message?: string };

export interface NetworkReading {
  downBytesPerSec: number;
  upBytesPerSec: number;
}

export interface BatteryReading {
  percent: number;
  charging: boolean;
  pluggedIn: boolean;
}

export type GpuEngineId = "3d" | "copy" | "decode" | "encode";

export interface GpuEngine {
  id: GpuEngineId;
  percent: number;
}

export interface GpuReading {
  name: string | null;
  percent: number | null;
  temperatureC: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  powerW: number | null;
  engines: GpuEngine[];
}

export interface ProgramReading {
  name: string;
  count: number;
  cpuPercent: number;
  memoryBytes: number;
}

export interface ProgramsReading {
  byCpu: ProgramReading[];
  byMemory: ProgramReading[];
}

export interface MonitorSample {
  takenAt: number;
  platform: Platform;
  cpuPercent: number;
  cores: number[];
  cpuModel: string;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  memoryPercent: number;
  uptimeSec: number;
  hostname: string;
  arch: string;
  cpuTemperatureC: Reading<number>;
  gpu: Reading<GpuReading>;
  network: Reading<NetworkReading>;
  battery: Reading<BatteryReading>;
  programs: Reading<ProgramsReading>;
}

export interface MonitorFeatures {
  cpuTemperature: boolean;
  gpu: boolean;
  gpuEngines: boolean;
  gpuTemperature: boolean;
  network: boolean;
  battery: boolean;
  programs: boolean;
  programIcons: boolean;
  openTaskManager: boolean;
}

export interface MonitorConfig {
  intervalMs: number;
  showOnBar: boolean;
  barCpu: boolean;
  barMemory: boolean;
  barCpuTemperature: boolean;
  barGpuTemperature: boolean;
  backgroundHistory: boolean;
  layout: Layout;
  locale: Locale;
}

export interface MonitorState {
  config: MonitorConfig;
  platform: Platform;
  features: MonitorFeatures;
  sample: MonitorSample | null;
  sampling: boolean;
  updatedAt: number;
}

export interface HistoryPoint {
  at: number;
  cpu: number;
  gpu: number | null;
  down: number | null;
  up: number | null;
}

export interface MonitorHistory {
  windowMs: number;
  points: HistoryPoint[];
}

export interface ProgramIcons {
  icons: Record<string, string | null>;
}

export const INTERVAL_OPTIONS = [1000, 2000, 5000, 10000] as const;

export const LAYOUT_OPTIONS = ["auto", "single", "double"] as const;

export const PAGE_INTERVAL_MS = 1000;
export const BACKGROUND_INTERVAL_MS = 5000;
export const GPU_INTERVAL_MS = 2000;
export const PROGRAMS_INTERVAL_MS = 3000;
export const BATTERY_INTERVAL_MS = 10000;
export const HISTORY_WINDOW_MS = 5 * 60 * 1000;
export const HISTORY_LIMIT = 300;
export const PROGRAMS_LIMIT = 10;

export const DEFAULT_CONFIG: MonitorConfig = {
  intervalMs: 2000,
  showOnBar: true,
  barCpu: true,
  barMemory: true,
  barCpuTemperature: false,
  barGpuTemperature: false,
  backgroundHistory: false,
  layout: "auto",
  locale: "zh-CN",
};

export const METHODS = {
  getState: "getState",
  setConfig: "setConfig",
  refresh: "refresh",
  watchPage: "watchPage",
  getHistory: "getHistory",
  getProgramIcons: "getProgramIcons",
  openTaskManager: "openTaskManager",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export function featuresFor(platform: Platform): MonitorFeatures {
  const windows = platform === "windows";
  const macos = platform === "macos";
  const known = windows || macos;
  return {
    cpuTemperature: windows,
    gpu: known,
    gpuEngines: windows,
    gpuTemperature: windows,
    network: known,
    battery: known,
    programs: known,
    programIcons: windows,
    openTaskManager: known,
  };
}

export function readingValue<T>(reading: Reading<T> | undefined): T | null {
  return reading?.status === "ok" ? reading.value : null;
}

export function historyPoint(sample: MonitorSample): HistoryPoint {
  const gpu = readingValue(sample.gpu);
  const network = readingValue(sample.network);
  return {
    at: sample.takenAt,
    cpu: sample.cpuPercent,
    gpu: gpu?.percent ?? null,
    down: network?.downBytesPerSec ?? null,
    up: network?.upBytesPerSec ?? null,
  };
}
