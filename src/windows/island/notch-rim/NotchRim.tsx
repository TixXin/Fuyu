import { useEffect, useId, useRef, type CSSProperties } from "react";
import type { NotchRimLook } from "../../../lib/settings/notchRimSettings";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";
import { rimGeometry, type RimGeometry } from "./rimGeometry";
import { AURORA_COLORS, rimPlan, rimShown, rimStatusOf, type RimLayer } from "./rimLook";
import { useRimBox } from "./useRimBox";
import { useRimRipple } from "./useRimRipple";
import "./NotchRim.css";

const PAD = 40;

export type NotchRimView = {
  island: NotchRimLook;
  panel: NotchRimLook;
  accent: string;
  paused: boolean;
};

type Props = { view: NotchRimView; expanded: boolean; glow: { color: string; pulse?: boolean; reason: string } | null };

function layerElement(layer: RimLayer, index: number | string, geometry: RimGeometry, ids: Record<string, string>) {
  const animation = layer.animation ? `notch-rim__anim notch-rim__anim--${layer.animation}` : undefined;
  const filter = layer.blur ? `url(#${ids[layer.blur]})` : undefined;
  if (layer.kind === "spot") {
    return <ellipse key={index} className={animation} cx={geometry.mid} cy={geometry.height + 2} rx={layer.rx} ry={layer.ry} style={{ fill: layer.color }} opacity={layer.opacity} filter={filter} />;
  }
  const paint = layer.paint === "solid" ? layer.color : `url(#${ids[layer.paint]})`;
  return (
    <path
      key={index}
      className={animation}
      d={geometry[layer.path]}
      fill="none"
      style={{ stroke: paint }}
      strokeWidth={layer.width}
      strokeLinecap={layer.dash ? "round" : undefined}
      opacity={layer.opacity}
      {...(layer.dash && { pathLength: 1000, strokeDasharray: `${layer.dash} 3000` })}
      clipPath={layer.clip ? `url(#${ids.clip})` : undefined}
      filter={filter}
    />
  );
}

export function NotchRim({ view, expanded, glow }: Props) {
  const status = rimStatusOf(glow);
  const look = expanded ? view.panel : view.island;
  const reducedMotion = useReducedMotion();
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const box = useRimBox(probeRef);
  const ripple = useRimRipple(look.status ? status : null);
  const id = useId().replace(/:/g, "");
  const ids = { clip: `${id}c`, mask: `${id}m`, fade: `${id}f`, aurora: `${id}a`, under: `${id}u`, soft: `${id}s`, wide: `${id}w` };
  const shown = rimShown(look, status) && box !== null && box.width > 0;
  const geometry = box ? rimGeometry(box) : null;
  const plan = geometry ? rimPlan(look, { accent: view.accent, status, motion: !reducedMotion, length: geometry.length, width: box?.width ?? 0, ripple: ripple.active }) : null;
  const paused = view.paused;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }, [paused, shown]);

  const fadeEnd = box ? box.fillet * 0.45 + 0.6 : 1;
  const width = (geometry?.boxWidth ?? 0) + 2 * PAD;
  const height = (geometry?.height ?? 0) + PAD;
  const t = plan?.width ?? 1;

  return (
    <div className={`notch-rim${paused ? " notch-rim--paused" : ""}`} aria-hidden="true" data-style={shown ? look.style : "off"}>
      <span ref={probeRef} className="notch-rim__probe" />
      {shown && geometry && plan && box && (
        <svg
          ref={svgRef}
          className="notch-rim__svg"
          width={width}
          height={height}
          viewBox={`${-PAD} 0 ${width} ${height}`}
          style={{ left: -box.fillet - PAD, "--notch-rim-duration": `${plan.duration}s`, "--notch-rim-twin-duration": `${plan.duration * 0.9}s` } as CSSProperties}
        >
          <defs>
            <clipPath id={ids.clip}><path d={geometry.fill} /></clipPath>
            <linearGradient id={ids.fade} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={fadeEnd}>
              <stop offset="0" stopColor="#000" />
              <stop offset="0.15" stopColor="#000" />
              <stop offset="1" stopColor="#fff" />
            </linearGradient>
            <mask id={ids.mask} maskUnits="userSpaceOnUse" x={-PAD} y="0" width={width} height={height}>
              <rect x={-PAD} y="0" width={width} height={height} fill={`url(#${ids.fade})`} />
            </mask>
            <linearGradient id={ids.aurora} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={geometry.boxWidth * 0.6} y2={geometry.height * 0.4} spreadMethod="reflect">
              {AURORA_COLORS.map((color, index) => <stop key={index} offset={index / (AURORA_COLORS.length - 1)} stopColor={color} />)}
              {plan.auroraFlow && <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to={`${geometry.boxWidth * 1.2} 0`} dur={`${plan.duration * 2}s`} repeatCount="indefinite" />}
            </linearGradient>
            <linearGradient id={ids.under} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={geometry.height}>
              <stop offset={Math.max(0, 1 - 26 / Math.max(geometry.height, 1))} style={{ stopColor: plan.color, stopOpacity: 0 }} />
              <stop offset="1" style={{ stopColor: plan.color }} />
            </linearGradient>
            <filter id={ids.soft} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation={2 + t * 1.5} /></filter>
            <filter id={ids.wide} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation={5 + t * 2} /></filter>
          </defs>
          <g mask={`url(#${ids.mask})`}>
            {plan.layers.map((layer, index) => layerElement(layer, layer.animation === "ripple" ? `ripple${ripple.key}` : index, geometry, ids))}
          </g>
        </svg>
      )}
    </div>
  );
}
