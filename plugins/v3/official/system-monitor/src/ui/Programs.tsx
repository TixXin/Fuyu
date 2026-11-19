import type { Context } from "@fuyu/plugin-base";
import { useEffect, useRef, useState } from "react";
import {
  METHODS,
  PROGRAMS_LIMIT,
  readingValue,
  type Locale,
  type MonitorFeatures,
  type MonitorSample,
  type Platform,
  type ProgramIcons,
  type ProgramReading,
} from "../protocol.ts";
import { TEXT, formatBytes, formatShortBytes } from "../text.ts";
import { useElementSize } from "./useElementSize.ts";

export type SortBy = "cpu" | "memory";

const ROW = 30;

export function rowsFor(height: number, columns: number): number {
  const rows = Math.max(1, Math.floor((height + 2) / ROW));
  return Math.min(PROGRAMS_LIMIT, rows * Math.max(1, columns));
}

export function programsShown(sample: MonitorSample): boolean {
  return sample.programs.status !== "unsupported" && sample.programs.status !== "absent";
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function useProgramIcons(ctx: Context, names: readonly string[], enabled: boolean) {
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const asked = useRef(new Set<string>());
  const key = names.join("\n");
  useEffect(() => {
    if (!enabled) return;
    const missing = key.split("\n").filter((name) => name && !asked.current.has(name));
    if (missing.length === 0) return;
    for (const name of missing) asked.current.add(name);
    ctx.host
      .call<ProgramIcons>(METHODS.getProgramIcons, { names: missing })
      .then((result) => {
        if (result?.icons) setIcons((prev) => ({ ...prev, ...result.icons }));
      })
      .catch(() => {
        for (const name of missing) asked.current.delete(name);
      });
  }, [ctx, key, enabled]);
  return icons;
}

function Row({
  program,
  sortBy,
  icon,
  memoryTotal,
  locale,
}: {
  program: ProgramReading;
  sortBy: SortBy;
  icon: string | null | undefined;
  memoryTotal: number;
  locale: Locale;
}) {
  const copy = TEXT[locale];
  const cpu = program.cpuPercent;
  const hot = sortBy === "cpu" ? cpu >= 20 : memoryTotal > 0 && program.memoryBytes / memoryTotal >= 0.2;
  const figure = sortBy === "cpu" ? `${cpu.toFixed(1)}%` : formatShortBytes(program.memoryBytes);
  return (
    <li title={`${program.name} · CPU ${cpu.toFixed(1)}% · ${formatBytes(program.memoryBytes)}`}>
      {icon ? (
        <img className="fuyu-sysmon-programs__icon" src={icon} alt="" />
      ) : (
        <span className="fuyu-sysmon-programs__initial" aria-hidden="true">
          {program.name.slice(0, 1)}
        </span>
      )}
      <span className="fuyu-sysmon-programs__name">
        {program.name}
        {program.count > 1 && (
          <span className="fuyu-sysmon-programs__count" aria-label={copy.processCount(program.count)}>
            {`×${program.count}`}
          </span>
        )}
      </span>
      <span className={`fuyu-sysmon-programs__figure${hot ? " fuyu-sysmon-programs__figure--hot" : ""}`}>{figure}</span>
    </li>
  );
}

export function Programs({
  ctx,
  sample,
  features,
  platform,
  locale,
  columns,
}: {
  ctx: Context;
  sample: MonitorSample;
  features: MonitorFeatures;
  platform: Platform;
  locale: Locale;
  columns: number;
}) {
  const copy = TEXT[locale];
  const [sortBy, setSortBy] = useState<SortBy>("cpu");
  const listRef = useRef<HTMLOListElement>(null);
  const { height } = useElementSize(listRef);
  const count = rowsFor(height, columns);
  const programs = readingValue(sample.programs);
  const rows = programs ? (sortBy === "cpu" ? programs.byCpu : programs.byMemory).slice(0, count) : null;
  const icons = useProgramIcons(
    ctx,
    rows?.map((row) => row.name) ?? [],
    features.programIcons,
  );
  const openLabel = copy.openTaskManager(platform);
  const [openError, setOpenError] = useState<string | null>(null);
  const open = () => {
    setOpenError(null);
    ctx.host.call(METHODS.openTaskManager).catch((reason: unknown) => {
      setOpenError(reason instanceof Error ? reason.message : String(reason));
    });
  };
  return (
    <section className="fuyu-sysmon-programs">
      <div className="fuyu-sysmon-programs__head">
        <span
          className={`fuyu-sysmon-programs__title${openError ? " fuyu-sysmon-programs__title--error" : ""}`}
          title={openError ?? undefined}
        >
          {openError ? copy.openFailed(platform) : sortBy === "cpu" ? copy.programsByCpu : copy.programsByMemory}
        </span>
        {features.openTaskManager && (
          <button type="button" className="fuyu-sysmon-programs__open" onClick={open} title={openLabel} aria-label={openLabel}>
            <OpenIcon />
          </button>
        )}
        <div className="fuyu-sysmon-toggle" role="group" aria-label={copy.sortLabel}>
          {(["cpu", "memory"] as const).map((key) => (
            <button key={key} type="button" aria-pressed={sortBy === key} onClick={() => setSortBy(key)}>
              {key === "cpu" ? copy.sortCpu : copy.sortMemory}
            </button>
          ))}
        </div>
      </div>
      <ol ref={listRef} className="fuyu-sysmon-programs__list" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {sample.programs.status === "error" ? (
          <li className="fuyu-sysmon-programs__note">{copy.unreadable}</li>
        ) : rows ? (
          rows.map((program) => (
            <Row
              key={program.name}
              program={program}
              sortBy={sortBy}
              icon={icons[program.name]}
              memoryTotal={sample.memoryTotalBytes}
              locale={locale}
            />
          ))
        ) : (
          Array.from({ length: count }, (_, index) => <li key={index} className="fuyu-sysmon-programs__placeholder" />)
        )}
      </ol>
    </section>
  );
}
