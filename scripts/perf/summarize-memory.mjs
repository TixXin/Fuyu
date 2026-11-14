import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("用法：node scripts/perf/summarize-memory.mjs <采样得到的 csv>");
  process.exit(1);
}

const MB = 1024 * 1024;
const rows = readFileSync(file, "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [time, elapsed, pid, kind, privateBytes, workingSet, handles, gdi, user] = line.split(",");
    return { time, elapsed: Number(elapsed), pid, kind, privateBytes: Number(privateBytes), workingSet: Number(workingSet), handles: Number(handles), gdi: Math.max(0, Number(gdi)), user: Math.max(0, Number(user)) };
  });

if (rows.length === 0) {
  console.error("没有采样数据。");
  process.exit(1);
}

const samples = new Map();
for (const row of rows) {
  if (!samples.has(row.elapsed)) samples.set(row.elapsed, []);
  samples.get(row.elapsed).push(row);
}
const times = [...samples.keys()].sort((a, b) => a - b);
const kinds = [...new Set(rows.map((row) => row.kind))].sort();

function series(pick, kind) {
  return times.map((time) => {
    const group = samples.get(time).filter((row) => !kind || row.kind === kind);
    return { hours: time / 3600, value: group.reduce((sum, row) => sum + pick(row), 0), count: group.length };
  });
}

function slopePerHour(points) {
  if (points.length < 3) return Number.NaN;
  const meanX = points.reduce((sum, point) => sum + point.hours, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.value, 0) / points.length;
  const spread = points.reduce((sum, point) => sum + (point.hours - meanX) ** 2, 0);
  if (spread === 0) return Number.NaN;
  return points.reduce((sum, point) => sum + (point.hours - meanX) * (point.value - meanY), 0) / spread;
}

function describe(points, scale, digits) {
  const values = points.map((point) => point.value / scale);
  const format = (value) => (Number.isNaN(value) ? "—" : value.toFixed(digits));
  return [format(values[0]), format(values.at(-1)), format(Math.min(...values)), format(Math.max(...values)), format(slopePerHour(points) / scale)];
}

function table(title, unit, pick, scale, digits) {
  console.log(`\n### ${title}（${unit}）\n`);
  console.log("| 进程类型 | 进程数 | 开始 | 结束 | 最小 | 最大 | 每小时增长 |");
  console.log("|---|---:|---:|---:|---:|---:|---:|");
  for (const kind of [...kinds, null]) {
    const points = series(pick, kind);
    const counts = points.map((point) => point.count);
    const count = Math.min(...counts) === Math.max(...counts) ? `${counts[0]}` : `${Math.min(...counts)}–${Math.max(...counts)}`;
    console.log(`| ${kind ?? "**合计**"} | ${count} | ${describe(points, scale, digits).join(" | ")} |`);
  }
}

const duration = (times.at(-1) - times[0]) / 3600;
console.log(`采样 ${times.length} 次，${rows[0].time} 起，历时 ${duration.toFixed(2)} 小时。`);
table("私有内存", "MB", (row) => row.privateBytes, MB, 1);
table("工作集", "MB", (row) => row.workingSet, MB, 1);
table("GDI 对象", "个", (row) => row.gdi, 1, 0);
table("USER 对象", "个", (row) => row.user, 1, 0);
table("句柄", "个", (row) => row.handles, 1, 0);
