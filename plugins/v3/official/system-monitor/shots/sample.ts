const NOW = Date.parse("2026-11-19T10:24:00");
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

const wave = (index: number, base: number, swing: number, period: number) =>
  Math.max(0, Math.round((base + swing * Math.sin(index / period) + (swing / 2) * Math.sin(index / (period / 3.7))) * 10) / 10);

const points = Array.from({ length: 300 }, (_, index) => ({
  at: NOW - (299 - index) * 1000,
  cpu: wave(index, 26, 14, 17),
  gpu: wave(index, 34, 18, 23),
  down: wave(index, 2.6, 2.2, 11) * MB,
  up: wave(index, 0.4, 0.3, 9) * MB,
}));

const programs = [
  { name: "Code", count: 14, cpuPercent: 8.4, memoryBytes: 2.3 * GB },
  { name: "chrome", count: 31, cpuPercent: 6.1, memoryBytes: 3.1 * GB },
  { name: "node", count: 6, cpuPercent: 4.7, memoryBytes: 0.9 * GB },
  { name: "Fuyu", count: 5, cpuPercent: 1.2, memoryBytes: 0.21 * GB },
  { name: "explorer", count: 1, cpuPercent: 0.8, memoryBytes: 0.18 * GB },
  { name: "WeChat", count: 4, cpuPercent: 0.6, memoryBytes: 0.64 * GB },
];

const state = {
  config: {
    intervalMs: 2000,
    showOnBar: true,
    barCpu: true,
    barMemory: true,
    barCpuTemperature: false,
    barGpuTemperature: false,
    backgroundHistory: false,
    layout: "auto",
    locale: "zh-CN",
  },
  platform: "windows",
  features: {
    cpuTemperature: true,
    gpu: true,
    gpuEngines: true,
    gpuTemperature: true,
    network: true,
    battery: true,
    programs: true,
    programIcons: true,
    openTaskManager: true,
  },
  sample: {
    takenAt: NOW,
    platform: "windows",
    cpuPercent: points[299].cpu,
    cores: [38, 22, 41, 17, 29, 12, 33, 19, 9, 14, 6, 11],
    cpuModel: "AMD Ryzen 7 7840HS",
    memoryUsedBytes: 13.6 * GB,
    memoryTotalBytes: 31.8 * GB,
    memoryPercent: 43,
    uptimeSec: 3 * 86400 + 5 * 3600 + 12 * 60,
    hostname: "fuyu-pc",
    arch: "x64",
    cpuTemperatureC: { status: "ok", value: 58 },
    gpu: {
      status: "ok",
      value: {
        name: "NVIDIA GeForce RTX 4060",
        percent: points[299].gpu,
        temperatureC: 52,
        memoryUsedBytes: 2.4 * GB,
        memoryTotalBytes: 8 * GB,
        powerW: 41,
        engines: [
          { id: "3d", percent: 31 },
          { id: "copy", percent: 4 },
          { id: "decode", percent: 12 },
          { id: "encode", percent: 0 },
        ],
      },
    },
    network: { status: "ok", value: { downBytesPerSec: points[299].down, upBytesPerSec: points[299].up } },
    battery: { status: "ok", value: { percent: 86, charging: true, pluggedIn: true } },
    programs: {
      status: "ok",
      value: {
        byCpu: programs,
        byMemory: [...programs].sort((a, b) => b.memoryBytes - a.memoryBytes),
      },
    },
  },
  sampling: false,
  updatedAt: NOW,
};

export default {
  now: NOW,
  host: {
    calls: {
      getState: state,
      watchPage: state,
      getHistory: { windowMs: 5 * 60 * 1000, points },
      getProgramIcons: { icons: {} },
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
