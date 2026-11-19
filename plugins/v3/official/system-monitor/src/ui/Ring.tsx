import { clampPercent, type Level } from "./thresholds.ts";

const RADIUS = 11.5;
const LENGTH = 2 * Math.PI * RADIUS;

export function Ring({
  value,
  letter,
  tone,
  level = "normal",
  size = 28,
}: {
  value: number | null;
  letter: string;
  tone: "cpu" | "gpu" | "memory";
  level?: Level;
  size?: number;
}) {
  const share = clampPercent(value);
  const className = `fuyu-sysmon-ring fuyu-sysmon-ring--${tone} fuyu-sysmon-ring--${level}${share < 0.5 ? " fuyu-sysmon-ring--empty" : ""}`;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle className="fuyu-sysmon-ring__track" cx="14" cy="14" r={RADIUS} />
      <circle
        className="fuyu-sysmon-ring__arc"
        cx="14"
        cy="14"
        r={RADIUS}
        strokeDasharray={LENGTH}
        strokeDashoffset={LENGTH * (1 - share / 100)}
        transform="rotate(-90 14 14)"
      />
      <text className="fuyu-sysmon-ring__label" x="14" y="14">
        {letter}
      </text>
    </svg>
  );
}
