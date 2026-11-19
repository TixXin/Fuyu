import type { Context } from "@fuyu/plugin-base";
import { readingValue, type Locale, type MonitorState } from "../protocol.ts";
import { TEXT, formatBytes } from "../text.ts";
import { useSystemMonitor } from "../useSystemMonitor.ts";
import { THRESHOLDS, levelOf, type Level } from "./thresholds.ts";

export interface BarCell {
  key: string;
  value: string;
  label: string;
  title: string;
  level: Level;
}

export function barCells(state: MonitorState, locale: Locale): BarCell[] {
  const copy = TEXT[locale];
  const { config, sample, features } = state;
  if (!config.showOnBar || !sample) return [];
  const cells: BarCell[] = [];
  if (config.barCpu) {
    cells.push({
      key: "cpu",
      value: `${Math.round(sample.cpuPercent)}%`,
      label: copy.barCpuShort,
      title: `CPU ${sample.cpuPercent.toFixed(1)}%`,
      level: levelOf(sample.cpuPercent, THRESHOLDS.cpu),
    });
  }
  if (config.barMemory) {
    cells.push({
      key: "memory",
      value: `${Math.round(sample.memoryPercent)}%`,
      label: copy.barMemShort,
      title: `${copy.memory} ${formatBytes(sample.memoryUsedBytes)} / ${formatBytes(sample.memoryTotalBytes)}`,
      level: levelOf(sample.memoryPercent, THRESHOLDS.memory),
    });
  }
  const cpuTemperature = readingValue(sample.cpuTemperatureC);
  if (config.barCpuTemperature && features.cpuTemperature && cpuTemperature !== null) {
    cells.push({
      key: "cpu-temperature",
      value: `${Math.round(cpuTemperature)}°`,
      label: copy.barCpuShort,
      title: `${copy.barCpuTempTitle} ${Math.round(cpuTemperature)}°C`,
      level: levelOf(cpuTemperature, THRESHOLDS.cpuTemperature),
    });
  }
  const gpuTemperature = readingValue(sample.gpu)?.temperatureC ?? null;
  if (config.barGpuTemperature && features.gpuTemperature && gpuTemperature !== null) {
    cells.push({
      key: "gpu-temperature",
      value: `${Math.round(gpuTemperature)}°`,
      label: copy.barGpuShort,
      title: `${copy.barGpuTempTitle} ${Math.round(gpuTemperature)}°C`,
      level: levelOf(gpuTemperature, THRESHOLDS.gpuTemperature),
    });
  }
  return cells;
}

export function CollapsedBar({ ctx }: { ctx: Context }) {
  const { state, locale } = useSystemMonitor(ctx, false);
  const cells = barCells(state, locale);
  if (cells.length === 0) return null;
  return (
    <span className="fuyu-sysmon-bar" title={cells.map((cell) => cell.title).join(" · ")}>
      {cells.map((cell) => (
        <span key={cell.key} className={`fuyu-sysmon-bar__cell fuyu-sysmon-bar__cell--${cell.level}`}>
          <b>{cell.value}</b>
          <em>{cell.label}</em>
        </span>
      ))}
    </span>
  );
}
