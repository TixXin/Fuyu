import type { GpuEngineId, Layout, Locale, Platform } from "./protocol.ts";

export function detectLocale(): Locale {
  if (typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language)) {
    return "zh-CN";
  }
  return "en";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Math.round(mb)} MB`;
  const kb = bytes / 1024;
  return `${Math.max(1, Math.round(kb))} KB`;
}

export function formatShortBytes(bytes: number): string {
  const units = ["B", "K", "M", "G", "T"];
  let value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const number = value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1);
  return `${number}${units[index]}`;
}

export function formatRate(bytesPerSec: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number.isFinite(bytesPerSec) && bytesPerSec > 0 ? bytesPerSec : 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const number = value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1);
  return `${number} ${units[index]}/s`;
}

export function formatGb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

export function formatUptime(seconds: number, locale: Locale): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (locale === "zh-CN") {
    if (days > 0) return `${days}天 ${hours}小时 ${minutes}分`;
    if (hours > 0) return `${hours}小时 ${minutes}分`;
    return `${minutes}分钟`;
  }
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export const PAGE_TITLE = { "zh-CN": "系统监控", en: "System monitor" } as const;

const zh = {
  title: PAGE_TITLE["zh-CN"] as string,
  reading: "正在读取…",
  unreadable: "读不到",
  memory: "内存",
  download: "下载",
  upload: "上传",
  battery: "电池",
  uptime: "已运行",
  charging: "充电中",
  onBattery: "使用电池",
  pluggedIn: "已接电源",
  vram: "显存",
  vramUsed: "已用",
  power: "显卡功耗",
  engines: { "3d": "3D", copy: "复制", decode: "解码", encode: "编码" } as Record<GpuEngineId, string>,
  cores: (count: number) => `${count} 核`,
  programsByCpu: "最占 CPU 的程序",
  programsByMemory: "最占内存的程序",
  sortCpu: "CPU",
  sortMemory: "内存",
  sortLabel: "排序",
  processCount: (count: number) => `${count} 个进程`,
  openTaskManager: (platform: Platform): string => (platform === "macos" ? "打开活动监视器" : "打开任务管理器"),
  openFailed: (platform: Platform): string => (platform === "macos" ? "没能打开活动监视器" : "没能打开任务管理器"),
  recent: (average: string, peak: string) => `最近 5 分钟：平均 ${average}，最高 ${peak}`,
  refresh: "刷新",
  intervalLabel: "收起条刷新间隔",
  intervalHint: "监控页开着时固定每秒刷新。",
  intervalOption: (ms: number) => `${ms / 1000} 秒`,
  layoutLabel: "排版",
  layoutOption: { auto: "自动（窄时一栏）", single: "一栏", double: "两栏" } as Record<Layout, string>,
  showOnBar: "在收起条显示实时指标",
  barCpu: "收起条显示 CPU 占用率",
  barMemory: "收起条显示内存占用率",
  barCpuTemperature: "收起条显示 CPU 温度",
  barGpuTemperature: "收起条显示 GPU 温度（NVIDIA 显卡）",
  backgroundHistory: "后台记录曲线",
  backgroundHistoryHint: "监控页关着时每 5 秒记一次 CPU、GPU 和网速，打开时就能看到最近 5 分钟。",
  save: "保存设置",
  idleHint: "当前未打开监控页且收起条已关闭，后台自动暂停采样。",
  barCpuShort: "CPU",
  barMemShort: "内存",
  barGpuShort: "GPU",
  barCpuTempTitle: "CPU 温度",
  barGpuTempTitle: "GPU 温度",
};

type Copy = typeof zh;

const en: Copy = {
  title: PAGE_TITLE.en,
  reading: "Reading…",
  unreadable: "Unavailable",
  memory: "Memory",
  download: "Download",
  upload: "Upload",
  battery: "Battery",
  uptime: "Up",
  charging: "charging",
  onBattery: "on battery",
  pluggedIn: "plugged in",
  vram: "VRAM",
  vramUsed: "used",
  power: "GPU power",
  engines: { "3d": "3D", copy: "Copy", decode: "Decode", encode: "Encode" },
  cores: (count: number) => (count === 1 ? "1 core" : `${count} cores`),
  programsByCpu: "Top programs by CPU",
  programsByMemory: "Top programs by memory",
  sortCpu: "CPU",
  sortMemory: "Memory",
  sortLabel: "Sort by",
  processCount: (count: number) => (count === 1 ? "1 process" : `${count} processes`),
  openTaskManager: (platform: Platform) => (platform === "macos" ? "Open Activity Monitor" : "Open Task Manager"),
  openFailed: (platform: Platform) => (platform === "macos" ? "Couldn't open Activity Monitor" : "Couldn't open Task Manager"),
  recent: (average: string, peak: string) => `Last 5 minutes: average ${average}, peak ${peak}`,
  refresh: "Refresh",
  intervalLabel: "Collapsed bar refresh interval",
  intervalHint: "The monitor page always refreshes every second while it is open.",
  intervalOption: (ms: number) => `${ms / 1000}s`,
  layoutLabel: "Layout",
  layoutOption: { auto: "Auto (one column when narrow)", single: "One column", double: "Two columns" },
  showOnBar: "Show live metrics on collapsed bar",
  barCpu: "Show CPU usage on collapsed bar",
  barMemory: "Show memory usage on collapsed bar",
  barCpuTemperature: "Show CPU temperature on collapsed bar",
  barGpuTemperature: "Show GPU temperature on collapsed bar (NVIDIA)",
  backgroundHistory: "Record charts in the background",
  backgroundHistoryHint: "While the page is closed, CPU, GPU and network are recorded every 5 seconds, so the last 5 minutes are there when you open it.",
  save: "Save settings",
  idleHint: "Background sampling pauses automatically when the page is closed and collapsed bar display is off.",
  barCpuShort: "CPU",
  barMemShort: "RAM",
  barGpuShort: "GPU",
  barCpuTempTitle: "CPU temperature",
  barGpuTempTitle: "GPU temperature",
};

export const TEXT: Record<Locale, Copy> = { "zh-CN": zh, en };
