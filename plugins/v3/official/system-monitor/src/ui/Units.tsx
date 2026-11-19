import { readingValue, type GpuEngine, type GpuReading, type MonitorSample, type Reading } from "../protocol.ts";
import { TEXT, formatGb } from "../text.ts";
import type { Locale } from "../protocol.ts";
import { Ring } from "./Ring.tsx";
import { Spark, recentSummary } from "./Spark.tsx";
import { THRESHOLDS, clampPercent, levelOf } from "./thresholds.ts";

const whole = (value: number) => `${Math.round(value)}%`;

function Figure({ value, unit, extra }: { value: string; unit?: string; extra?: string }) {
  return (
    <strong className="fuyu-sysmon-gauge__value">
      {value}
      {unit && <span className="fuyu-sysmon-gauge__unit">{unit}</span>}
      {extra && <small>{extra}</small>}
    </strong>
  );
}

function Cores({ cores }: { cores: readonly number[] }) {
  const gap = cores.length > 32 ? 1 : cores.length > 16 ? 2 : 3;
  return (
    <div className="fuyu-sysmon-cores" style={{ gap }} aria-hidden="true">
      {cores.map((value, index) => (
        <span key={index} className="fuyu-sysmon-cores__core">
          <span style={{ height: `${Math.max(6, clampPercent(value))}%` }} />
        </span>
      ))}
    </div>
  );
}

function Engines({ engines, locale }: { engines: readonly GpuEngine[]; locale: Locale }) {
  const names = TEXT[locale].engines;
  return (
    <div className="fuyu-sysmon-engines">
      {engines.map((engine) => {
        const name = names[engine.id] ?? engine.id;
        return (
          <div key={engine.id} className="fuyu-sysmon-engine" title={`${name} ${Math.round(engine.percent)}%`}>
            <span className="fuyu-sysmon-engine__bar">
              <span style={{ height: `${clampPercent(engine.percent)}%` }} />
            </span>
            <span className="fuyu-sysmon-engine__name">{name}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CpuUnit({
  sample,
  history,
  locale,
}: {
  sample: MonitorSample;
  history: readonly number[];
  locale: Locale;
}) {
  const copy = TEXT[locale];
  const cpu = clampPercent(sample.cpuPercent);
  const temperature = readingValue(sample.cpuTemperatureC);
  const summary = recentSummary(history, whole);
  const model = sample.cpuModel || "CPU";
  return (
    <section
      className="fuyu-sysmon-unit"
      title={summary ? copy.recent(...summary) : undefined}
      aria-label={`CPU ${whole(cpu)}`}
    >
      <div className="fuyu-sysmon-gauge">
        <Ring value={cpu} letter="C" tone="cpu" level={levelOf(cpu, THRESHOLDS.cpu)} />
        <div className="fuyu-sysmon-gauge__text">
          <Figure value={String(Math.round(cpu))} unit="%" extra={temperature !== null ? `${Math.round(temperature)}°C` : undefined} />
          <span className="fuyu-sysmon-gauge__extra" title={model}>
            {`${model} · ${copy.cores(sample.cores.length)}`}
          </span>
        </div>
      </div>
      <Spark values={history} max={100} tone="cpu" />
      <Cores cores={sample.cores} />
    </section>
  );
}

export function gpuShownFor(reading: Reading<GpuReading>): boolean {
  return reading.status !== "unsupported" && reading.status !== "absent";
}

function shortGpuName(name: string | null): string {
  if (!name) return "GPU";
  return name.replace(/^(NVIDIA|AMD|Intel\(R\)) (GeForce |Radeon\(TM\) |Radeon |Arc\(TM\) )?/, "") || name;
}

export function GpuUnit({
  reading,
  history,
  locale,
}: {
  reading: Reading<GpuReading>;
  history: readonly number[];
  locale: Locale;
}) {
  const copy = TEXT[locale];
  const gpu = readingValue(reading);
  const percent = gpu?.percent ?? null;
  const summary = recentSummary(history, whole);
  const small = gpu
    ? [gpu.temperatureC !== null ? `${Math.round(gpu.temperatureC)}°C` : null, gpu.powerW !== null ? `${Math.round(gpu.powerW)} W` : null]
        .filter(Boolean)
        .join(" · ")
    : "";
  const memory =
    gpu && gpu.memoryUsedBytes !== null
      ? gpu.memoryTotalBytes !== null
        ? `${copy.vram} ${formatGb(gpu.memoryUsedBytes)} / ${formatGb(gpu.memoryTotalBytes)} GB`
        : `${copy.vramUsed} ${formatGb(gpu.memoryUsedBytes)} GB`
      : null;
  const extra =
    reading.status === "error"
      ? copy.unreadable
      : [shortGpuName(gpu?.name ?? null), memory].filter(Boolean).join(" · ");
  const engines = gpu?.engines ?? [];
  return (
    <section
      className={`fuyu-sysmon-unit${engines.length === 0 ? " fuyu-sysmon-unit--no-detail" : ""}`}
      title={summary ? copy.recent(...summary) : undefined}
      aria-label={`GPU ${percent !== null ? whole(percent) : "—"}`}
    >
      <div className="fuyu-sysmon-gauge">
        <Ring value={percent} letter="G" tone="gpu" level={levelOf(gpu?.temperatureC ?? null, THRESHOLDS.gpuTemperature)} />
        <div className="fuyu-sysmon-gauge__text">
          {percent !== null ? (
            <Figure value={String(Math.round(clampPercent(percent)))} unit="%" extra={small || undefined} />
          ) : (
            <Figure value="—" />
          )}
          <span className="fuyu-sysmon-gauge__extra" title={gpu?.name ?? undefined}>
            {extra}
          </span>
        </div>
      </div>
      <Spark values={history} max={100} tone="gpu" />
      {engines.length > 0 && <Engines engines={engines} locale={locale} />}
    </section>
  );
}
