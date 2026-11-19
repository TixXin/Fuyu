import { HISTORY_LIMIT } from "../protocol.ts";

const WIDTH = 120;
const MIN_SPAN = 60;

export function Spark({
  values,
  max,
  tone,
  height = 40,
}: {
  values: readonly number[];
  max: number;
  tone: "cpu" | "gpu" | "down" | "up";
  height?: number;
}) {
  const className = `fuyu-sysmon-spark fuyu-sysmon-spark--${tone}`;
  if (values.length === 0 || max <= 0) {
    return <svg className={className} viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" aria-hidden="true" />;
  }
  const span = Math.min(HISTORY_LIMIT, Math.max(MIN_SPAN, values.length));
  const step = WIDTH / (span - 1);
  const start = WIDTH - step * (values.length - 1);
  const points = values.map((value, index) => {
    const x = start + index * step;
    const y = height - (Math.min(Math.max(0, value), max) / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  return (
    <svg className={className} viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className="fuyu-sysmon-spark__fill" points={`${line} ${WIDTH},${height} ${start.toFixed(1)},${height}`} />
      <polyline className="fuyu-sysmon-spark__line" points={line} />
    </svg>
  );
}

export function recentSummary(values: readonly number[], format: (value: number) => string): [string, string] | null {
  if (values.length === 0) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return [format(average), format(Math.max(...values))];
}
