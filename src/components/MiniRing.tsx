import type { CSSProperties } from "react";
import { ringArc, ringRadius, segmentStarts } from "../utils/ring.ts";
import "./MiniRing.css";

export type MiniRingTrack = { value: number; color: string; trackColor?: string };
export type MiniRingSegment = { value: number; color: string };

type MiniRingProps = {
  rings?: readonly MiniRingTrack[];
  segments?: readonly MiniRingSegment[];
  size?: number;
  strokeWidth?: number;
  gap?: number;
  trackColor?: string;
  label?: string;
  ariaLabel: string;
  title?: string;
  className?: string;
};

const DEFAULT_TRACK = "rgba(var(--island-ink-rgb, 241, 240, 246), 0.12)";

export function MiniRing({
  rings = [],
  segments,
  size = 20,
  strokeWidth = 2.5,
  gap = 1.5,
  trackColor = DEFAULT_TRACK,
  label,
  ariaLabel,
  title,
  className,
}: MiniRingProps) {
  const center = size / 2;
  const circle = (key: string, radius: number, color: string, arc: ReturnType<typeof ringArc> | "track") => (
    <circle
      key={key}
      className={arc === "track" ? "mini-ring__track" : "mini-ring__arc"}
      cx={center}
      cy={center}
      r={radius}
      style={{ stroke: color }}
      strokeWidth={strokeWidth}
      strokeDasharray={arc === "track" ? undefined : arc?.dashArray}
      strokeDashoffset={arc === "track" ? undefined : arc?.dashOffset}
    />
  );
  const parts = [];
  if (segments) {
    const radius = ringRadius(size, strokeWidth, 0, gap);
    const shown = segmentStarts(segments.map((segment) => segment.value));
    const segmentGap = shown.filter((segment) => segment.share > 0).length > 1 ? gap : 0;
    parts.push(circle("track", radius, trackColor, "track"));
    shown.forEach(({ start, share }, index) => {
      const arc = ringArc(radius, strokeWidth, start, share, segmentGap);
      if (arc) parts.push(circle(`segment-${index}`, radius, segments[index].color, arc));
    });
  } else {
    rings.forEach((ring, index) => {
      const radius = ringRadius(size, strokeWidth, index, gap);
      if (radius <= 0) return;
      parts.push(circle(`track-${index}`, radius, ring.trackColor ?? trackColor, "track"));
      const arc = ringArc(radius, strokeWidth, 0, ring.value);
      if (arc) parts.push(circle(`ring-${index}`, radius, ring.color, arc));
    });
  }

  return (
    <span
      className={["mini-ring", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
      title={title}
      style={{ "--mini-ring-size": `${size}px` } as CSSProperties}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${center} ${center})`}>{parts}</g>
      </svg>
      {label && <span className="mini-ring__label" aria-hidden="true">{label}</span>}
    </span>
  );
}
