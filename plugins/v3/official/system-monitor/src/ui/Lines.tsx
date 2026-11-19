import { readingValue, type Locale, type MonitorSample } from "../protocol.ts";
import { TEXT, formatGb, formatRate, formatUptime } from "../text.ts";
import { Ring } from "./Ring.tsx";
import { Spark, recentSummary } from "./Spark.tsx";
import { THRESHOLDS, clampPercent, levelOf } from "./thresholds.ts";

const RATE_FLOOR = 64 * 1024;

export function MemoryLine({ sample, locale }: { sample: MonitorSample; locale: Locale }) {
  const copy = TEXT[locale];
  const share = clampPercent(sample.memoryPercent);
  const level = levelOf(share, THRESHOLDS.memory);
  const used = formatGb(sample.memoryUsedBytes);
  const total = Number(formatGb(sample.memoryTotalBytes));
  return (
    <section className="fuyu-sysmon-line" aria-label={`${copy.memory} ${used} / ${total} GB, ${Math.round(share)}%`}>
      <Ring value={share} letter="M" tone="memory" level={level} size={24} />
      <span className="fuyu-sysmon-line__value">
        {used}
        <small>{` / ${total} GB`}</small>
      </span>
      <span className={`fuyu-sysmon-meter fuyu-sysmon-meter--${level}`}>
        <span style={{ width: `${share}%` }} />
      </span>
      <span className="fuyu-sysmon-line__percent">{`${Math.round(share)}%`}</span>
    </section>
  );
}

export function networkShown(sample: MonitorSample): boolean {
  return sample.network.status !== "unsupported" && sample.network.status !== "absent";
}

export function NetworkLine({
  sample,
  down,
  up,
  locale,
}: {
  sample: MonitorSample;
  down: readonly number[];
  up: readonly number[];
  locale: Locale;
}) {
  const copy = TEXT[locale];
  const network = readingValue(sample.network);
  const failed = sample.network.status === "error";
  const max = Math.max(RATE_FLOOR, ...down, ...up);
  const item = (kind: "down" | "up", values: readonly number[], rate: number | undefined) => {
    const summary = recentSummary(values, formatRate);
    const label = kind === "down" ? copy.download : copy.upload;
    return (
      <span
        className={`fuyu-sysmon-net__item fuyu-sysmon-net__item--${kind}`}
        title={summary ? `${label} · ${copy.recent(...summary)}` : label}
      >
        <span className="fuyu-sysmon-net__arrow" aria-label={label}>
          {kind === "down" ? "↓" : "↑"}
        </span>
        <span className="fuyu-sysmon-net__rate">
          {rate !== undefined ? formatRate(rate) : failed ? copy.unreadable : "—"}
        </span>
        <Spark values={values} max={max} tone={kind} height={18} />
      </span>
    );
  };
  return (
    <section className="fuyu-sysmon-net">
      {item("down", down, network?.downBytesPerSec)}
      {item("up", up, network?.upBytesPerSec)}
    </section>
  );
}

export function extraParts(sample: MonitorSample, locale: Locale): Array<[string, string]> {
  const copy = TEXT[locale];
  const parts: Array<[string, string]> = [];
  const battery = readingValue(sample.battery);
  if (battery) {
    const state = battery.charging ? copy.charging : battery.pluggedIn ? copy.pluggedIn : copy.onBattery;
    parts.push([copy.battery, `${battery.charging ? "⚡" : ""}${Math.round(battery.percent)}% · ${state}`]);
  }
  parts.push([copy.uptime, formatUptime(sample.uptimeSec, locale)]);
  return parts;
}

export function ExtraLine({ sample, locale }: { sample: MonitorSample; locale: Locale }) {
  const parts = extraParts(sample, locale);
  return (
    <section className="fuyu-sysmon-extra">
      {parts.map(([label, value]) => (
        <span key={label}>
          {`${label} `}
          <strong>{value}</strong>
        </span>
      ))}
    </section>
  );
}
