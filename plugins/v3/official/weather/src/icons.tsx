import type { ReactNode } from "react";
import type { ConditionKind } from "./conditions.ts";

function Svg({ size = 16, children }: { size?: number | string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const CLOUD_TOP = "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242";

const PATHS: Record<ConditionKind | "night", string[]> = {
  clear: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"],
  night: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  partly: ["M12 2v2", "m4.93 4.93 1.41 1.41", "M20 12h2", "m19.07 4.93-1.41 1.41", "M15.947 12.65a4 4 0 0 0-5.925-4.128", "M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"],
  cloudy: ["M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"],
  fog: [CLOUD_TOP, "M16 17H7", "M17 21H9"],
  rain: [CLOUD_TOP, "M16 14v6", "M8 14v6", "M12 16v6"],
  snow: [CLOUD_TOP, "M8 15h.01", "M8 19h.01", "M12 17h.01", "M12 21h.01", "M16 15h.01", "M16 19h.01"],
  storm: ["M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973", "m13 12-3 5h4l-3 5"],
};

export function ConditionIcon({ kind, day = 1, size = 16 }: { kind: ConditionKind; day?: number; size?: number | string }) {
  const key = kind === "clear" && day === 0 ? "night" : kind;
  return (
    <Svg size={size}>
      {PATHS[key].map((d) => (
        <path key={d} d={d} />
      ))}
    </Svg>
  );
}

export function WeatherIcon({ size = 16 }: { size?: number | string }) {
  return <ConditionIcon kind="partly" size={size} />;
}

export function RefreshIcon({ size = 14 }: { size?: number | string }) {
  return (
    <Svg size={size}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Svg>
  );
}
