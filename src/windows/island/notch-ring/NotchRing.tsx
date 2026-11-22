import { useEffect, useId, useRef, type CSSProperties } from "react";
import type { NotchRingLook } from "../../../lib/settings/notchRingSettings";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";
import { ringGeometry, type RingGeometry } from "./ringGeometry";
import { RING_AURORA_COLORS, ringPlan, type RingGlow, type RingLayer, type RingPlan, type RingPlayback } from "./ringPlan";
import "./NotchRing.css";

export type NotchRingView = {
  island: NotchRingLook;
  panel: NotchRingLook;
  accent: string;
  paused: boolean;
};

type Props = {
  view: NotchRingView;
  expanded: boolean;
  notch: { width: number; height: number };
  glow: RingGlow;
  playback: RingPlayback;
};

type Ids = { mask: string; fade: string; aurora: string; soft: string; wide: string };

function progressDash(plan: RingPlan) {
  const share = plan.progress && plan.progress.durationMs > 0 ? plan.progress.elapsedMs / plan.progress.durationMs : 0;
  return `${Math.round(share * 1000)} 2000`;
}

function layerElement(layer: RingLayer, index: number, geometry: RingGeometry, plan: RingPlan, ids: Ids, motion: boolean) {
  const animated = layer.animation !== undefined && (motion || layer.animation !== "progress");
  const className = animated ? `notch-ring__anim notch-ring__anim--${layer.animation}` : undefined;
  const filter = layer.blur ? `url(#${ids[layer.blur]})` : undefined;
  if (layer.kind === "drop") {
    return <circle key={index} className={className} cx={geometry.mid} cy={geometry.bottom + 3} r={layer.radius} style={{ fill: plan.color }} opacity={layer.opacity} filter={filter} />;
  }
  const paint = layer.paint === "aurora" ? `url(#${ids.aurora})` : layer.paint === "white" ? "#ffffff" : plan.color;
  const dash = layer.animation === "progress" && !motion ? progressDash(plan) : layer.dash;
  return (
    <path
      key={index}
      className={className}
      d={geometry[layer.path]}
      fill="none"
      style={{ stroke: paint }}
      strokeWidth={layer.width}
      strokeLinecap="round"
      opacity={layer.opacity}
      pathLength={layer.measured ? 1000 : undefined}
      strokeDasharray={dash}
      filter={filter}
    />
  );
}

export function NotchRing({ view, expanded, notch, glow, playback }: Props) {
  const look = expanded ? view.panel : view.island;
  const reducedMotion = useReducedMotion();
  const motion = look.motion && !reducedMotion;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const clockRef = useRef({ key: "", at: 0 });
  const id = useId().replace(/:/g, "");
  const ids: Ids = { mask: `${id}m`, fade: `${id}f`, aurora: `${id}a`, soft: `${id}s`, wide: `${id}w` };
  const geometry = ringGeometry(notch.width, notch.height, look.gap);
  const clockKey = `${expanded ? 1 : 0}|${look.style}|${glow?.reason ?? ""}|${playback?.startedAt ?? ""}|${motion ? 1 : 0}`;
  if (clockRef.current.key !== clockKey) clockRef.current = { key: clockKey, at: Date.now() };
  const plan = geometry ? ringPlan(look, { accent: view.accent, glow, playback, motion, now: clockRef.current.at }) : null;
  const shown = plan !== null && geometry !== null;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (view.paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }, [view.paused, shown]);

  if (!shown) return null;
  const t = plan.width;
  const progress = plan.progress && motion
    ? { "--notch-ring-progress": `${plan.progress.durationMs}ms`, "--notch-ring-progress-at": `-${plan.progress.elapsedMs}ms` }
    : {};
  const enterKey = `${clockKey}|${plan.color}`;

  return (
    <div className={`notch-ring${view.paused ? " notch-ring--paused" : ""}`} aria-hidden="true" data-style={plan.style} data-lit={plan.lit ? "" : undefined}>
      <svg
        key={enterKey}
        ref={svgRef}
        className="notch-ring__svg"
        width={geometry.width}
        height={geometry.height}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        style={{ left: `calc(50% - ${geometry.width / 2}px)`, ...progress } as CSSProperties}
      >
        <defs>
          <linearGradient id={ids.fade} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="5">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.2" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id={ids.mask} maskUnits="userSpaceOnUse" x="0" y="0" width={geometry.width} height={geometry.height}>
            <rect width={geometry.width} height={geometry.height} fill={`url(#${ids.fade})`} />
            <path d={geometry.body} fill="#000" />
          </mask>
          <linearGradient id={ids.aurora} gradientUnits="userSpaceOnUse" x1={geometry.notchLeft} y1="0" x2={geometry.notchLeft + geometry.length * 0.5} y2={geometry.notchHeight} spreadMethod="reflect">
            {RING_AURORA_COLORS.map((color, index) => <stop key={index} offset={index / (RING_AURORA_COLORS.length - 1)} stopColor={color} />)}
            {plan.auroraFlow && <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to={`${geometry.length * 1.2} 0`} dur="7s" repeatCount="indefinite" />}
          </linearGradient>
          <filter id={ids.soft} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation={1.5 + t} /></filter>
          <filter id={ids.wide} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation={3 + t * 1.5} /></filter>
        </defs>
        <g mask={`url(#${ids.mask})`}>
          {plan.layers.map((layer, index) => layerElement(layer, index, geometry, plan, ids, motion))}
        </g>
      </svg>
    </div>
  );
}
