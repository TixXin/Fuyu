import { useId, type CSSProperties } from "react";
import type { PetMood } from "../center-pattern/patterns";
import "./JellyfishMark.css";

export const JELLY_VIEW_WIDTH = 58;
export const JELLY_VIEW_HEIGHT = 43;
const VIEW_BOX = `3 4 ${JELLY_VIEW_WIDTH} ${JELLY_VIEW_HEIGHT}`;
const BELL = "M5 30.5C5 16 17 7 32 7S59 16 59 30.5c0 3-2.4 5.5-5.4 5.5H10.4C7.4 36 5 33.5 5 30.5Z";
const LOBES = [18, 27.3, 36.7, 46];
const LOBE_Y = 39;
const LOBE_R = 6.6;

function Shape() {
  return (
    <>
      {LOBES.map((x) => (
        <circle key={x} cx={x} cy={LOBE_Y} r={LOBE_R} />
      ))}
      <path d={BELL} />
    </>
  );
}

function Eyes() {
  return (
    <>
      <ellipse className="center-jelly-eye" cx={24} cy={25} rx={2.9} ry={4.1} />
      <ellipse className="center-jelly-eye" cx={40} cy={25} rx={2.9} ry={4.1} />
    </>
  );
}

function Face({ mood }: { mood: PetMood }) {
  if (mood === "done") {
    return (
      <g className="center-jelly-lids">
        <path className="center-jelly-line" d="M20.6 26.4a3.4 3.4 0 0 1 6.8 0M36.6 26.4a3.4 3.4 0 0 1 6.8 0" />
      </g>
    );
  }
  if (mood === "running") {
    return (
      <>
        <g className="center-jelly-lids" transform="translate(-2.2 .6)">
          <Eyes />
        </g>
        <path className="center-jelly-line center-jelly-mouth" d="M27.4 31.8h4" />
      </>
    );
  }
  if (mood === "waiting") {
    return (
      <>
        <g transform="translate(0 -1)">
          <g className="center-jelly-lids">
            <Eyes />
          </g>
        </g>
        <path className="center-jelly-eye" d="M28.2 30.4h7.6a3.8 3.8 0 0 1-7.6 0Z" />
        <ellipse className="center-jelly-tongue" cx={32} cy={33.1} rx={2} ry={1.1} />
      </>
    );
  }
  return (
    <>
      <g className="center-jelly-lids">
        <Eyes />
      </g>
      {mood === "failed" && <path className="center-jelly-line" d="M18.5 17.2l8 3.2M45.5 17.2l-8 3.2" />}
    </>
  );
}

function star(cx: number, cy: number, r: number) {
  return `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;
}

function Effect({ mood }: { mood: PetMood }) {
  if (mood === "waiting") return <path className="center-jelly-fx center-jelly-tick" d="M55 6l1.4-5M59 9.5l4.2-3.4M61 15l5-1" />;
  if (mood === "failed") {
    return (
      <path
        className="center-jelly-fx center-jelly-anger"
        d="M55.5 3.5c1.6 0 2.5-.9 2.5-2.5M62.5 3.5c-1.6 0-2.5-.9-2.5-2.5M55.5 7.5c1.6 0 2.5.9 2.5 2.5M62.5 7.5c-1.6 0-2.5.9-2.5 2.5"
      />
    );
  }
  if (mood === "done") {
    return (
      <>
        <path className="center-jelly-fx center-jelly-spark" d={star(57, 4, 4.4)} />
        <path className="center-jelly-fx center-jelly-spark" d={star(62.5, 12, 2.8)} />
      </>
    );
  }
  return null;
}

export function JellyfishMark({ mood, paused = false, height }: { mood: PetMood; paused?: boolean; height?: number }) {
  const shade = `center-jelly-shade-${useId().replace(/:/g, "")}`;
  const shadeFill = `url(#${shade})`;
  return (
    <span
      className="center-jelly"
      data-mood={mood}
      data-paused={paused || undefined}
      style={height === undefined ? undefined : ({ "--center-jelly-height": `${height}px` } as CSSProperties)}
      aria-hidden="true"
    >
      <svg viewBox={VIEW_BOX}>
        <defs>
          <linearGradient id={shade} gradientUnits="userSpaceOnUse" x1={0} y1={6} x2={0} y2={48}>
            <stop offset={0} stopColor="#fff" stopOpacity={0.5} />
            <stop offset={0.5} stopColor="#fff" stopOpacity={0} />
            <stop offset={1} stopColor="#000" stopOpacity={0.14} />
          </linearGradient>
        </defs>
        <g className="center-jelly-pose">
          <g className="center-jelly-body">
            <g className="center-jelly-outline">
              <Shape />
            </g>
            <g className="center-jelly-lobes">
              {LOBES.map((x) => (
                <g key={x} className="center-jelly-lobe" style={{ transformOrigin: `${x}px 33px` }}>
                  <circle className="center-jelly-fill" cx={x} cy={LOBE_Y} r={LOBE_R} />
                  <circle cx={x} cy={LOBE_Y} r={LOBE_R} fill={shadeFill} />
                </g>
              ))}
            </g>
            <g className="center-jelly-head">
              <path className="center-jelly-fill" d={BELL} />
              <path d={BELL} fill={shadeFill} />
              <ellipse className="center-jelly-highlight" cx={19} cy={14} rx={7.5} ry={3.4} transform="rotate(-26 19 14)" />
              <ellipse className="center-jelly-cheek" cx={17.6} cy={31.5} rx={3.6} ry={2.2} />
              <ellipse className="center-jelly-cheek" cx={46.4} cy={31.5} rx={3.6} ry={2.2} />
              <Face mood={mood} />
            </g>
          </g>
        </g>
        <Effect mood={mood} />
      </svg>
    </span>
  );
}
