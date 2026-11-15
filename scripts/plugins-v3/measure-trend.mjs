#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { median } from "./measure-memory.mjs";

export function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const names = header.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [names[index], value])));
}

export function fit(points) {
  const count = points.length;
  if (count < 2) return null;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / count;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / count;
  let top = 0;
  let bottom = 0;
  for (const [x, y] of points) {
    top += (x - meanX) * (y - meanY);
    bottom += (x - meanX) ** 2;
  }
  return bottom ? top / bottom : null;
}

const round = (value, digits = 1) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits);

export function trend(rows, { skipMinutes = 10, windowMinutes = 60 } = {}) {
  const samples = rows.filter((row) => row.memory_mb !== "").map((row) => ({ hours: Number(row.elapsed_s) / 3600, mb: Number(row.memory_mb), ping: Number(row.ping_ms), restarts: Number(row.restarts) }));
  const kept = samples.filter((sample) => sample.hours * 60 >= skipMinutes);
  const span = kept.length ? kept.at(-1).hours : 0;
  const head = kept.filter((sample) => sample.hours * 60 < skipMinutes + windowMinutes).map((sample) => sample.mb);
  const tail = kept.filter((sample) => sample.hours >= span - windowMinutes / 60).map((sample) => sample.mb);
  const values = kept.map((sample) => sample.mb);
  return {
    samples: samples.length,
    missing: rows.length - samples.length,
    hours: round(samples.at(-1)?.hours ?? 0, 2),
    minMB: values.length ? Math.min(...values) : null,
    maxMB: values.length ? Math.max(...values) : null,
    firstHourMedianMB: round(median(head)),
    lastHourMedianMB: round(median(tail)),
    slopeMBPerHour: round(fit(kept.map((sample) => [sample.hours, sample.mb])), 2),
    maxPingMs: samples.length ? Math.max(...samples.map((sample) => sample.ping)) : null,
    restarts: samples.length ? Math.max(...samples.map((sample) => sample.restarts)) : null,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { skip: { type: "string", default: "10" }, window: { type: "string", default: "60" } } });
  if (!positionals[0]) {
    process.stderr.write("node scripts/plugins-v3/measure-trend.mjs <soak.csv> [--skip 10] [--window 60]\n");
    process.exit(2);
  }
  const result = trend(parseCsv(readFileSync(positionals[0], "utf8")), { skipMinutes: Number(values.skip), windowMinutes: Number(values.window) });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
