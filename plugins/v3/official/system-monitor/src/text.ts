import type { Locale } from "./protocol.ts";

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

export const TEXT = {
  "zh-CN": {
    title: "系统监控",
    refresh: "刷新",
    cpu: "处理器",
    memory: "内存",
    coresHeading: (count: number) => `每核负载（${count} 核）`,
    uptime: "已运行",
    host: "主机",
    arch: "架构",
    intervalLabel: "采样间隔",
    intervalOption: (ms: number) => `${ms / 1000} 秒`,
    showOnBar: "在收起条显示实时指标",
    barCpu: "收起条显示 CPU 占用率",
    barMemory: "收起条显示内存占用率",
    save: "保存设置",
    idleHint: "当前未打开监控页且收起条已关闭，后台自动暂停采样。",
    barCpuShort: "CPU",
    barMemShort: "内存",
  },
  en: {
    title: "System monitor",
    refresh: "Refresh",
    cpu: "CPU",
    memory: "Memory",
    coresHeading: (count: number) => `Per-core load (${count} cores)`,
    uptime: "Uptime",
    host: "Host",
    arch: "Arch",
    intervalLabel: "Sampling interval",
    intervalOption: (ms: number) => `${ms / 1000}s`,
    showOnBar: "Show live metrics on collapsed bar",
    barCpu: "Show CPU usage on collapsed bar",
    barMemory: "Show memory usage on collapsed bar",
    save: "Save settings",
    idleHint: "Background sampling pauses automatically when the page is closed and collapsed bar display is off.",
    barCpuShort: "CPU",
    barMemShort: "RAM",
  },
} as const;
