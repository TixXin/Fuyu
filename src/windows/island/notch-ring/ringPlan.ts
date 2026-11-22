import type { NotchRingLook, NotchRingStyle } from "../../../lib/settings/notchRingSettings.ts";

export type RingGlow = { color: string; reason: string; pulse?: boolean } | null;
export type RingPlayback = { startedAt: number; durationMs: number } | null;

export type RingAnimation = "breathe" | "pulse" | "scan" | "twin" | "drip" | "progress" | "beat" | "turn";

export type RingLayer =
  | {
      kind: "line";
      path: "ring" | "left" | "right" | "ticks";
      width: number;
      opacity: number;
      paint: "solid" | "white" | "aurora";
      blur?: "soft" | "wide";
      dash?: string;
      measured?: boolean;
      animation?: RingAnimation;
    }
  | { kind: "drop"; radius: number; opacity: number; blur?: "soft"; animation?: RingAnimation };

export type RingPlan = {
  style: NotchRingStyle;
  color: string;
  lit: boolean;
  width: number;
  layers: RingLayer[];
  auroraFlow: boolean;
  progress: { durationMs: number; elapsedMs: number } | null;
};

const PALETTE: Record<Exclude<NotchRingLook["color"], "custom" | "accent">, string> = {
  white: "#ffffff",
  violet: "#bf5af2",
  pink: "#ff375f",
  mint: "#63e6be",
};

export const RING_AURORA_COLORS = ["#5ac8fa", "#bf5af2", "#ff375f", "#ff9f0a", "#63e6be", "#5ac8fa"] as const;

export function ringLit(look: NotchRingLook, glow: RingGlow): boolean {
  if (!glow) return false;
  return glow.reason.startsWith("device-use.") ? look.device : look.status;
}

export function ringColor(look: NotchRingLook, accent: string): string {
  if (look.color === "custom") return look.customColor;
  if (look.color === "accent") return accent;
  return PALETTE[look.color];
}

export function effectiveStyle(style: NotchRingStyle, { lit, playing, motion }: { lit: boolean; playing: boolean; motion: boolean }): NotchRingStyle {
  if ((style === "progress" || style === "beat") && !playing) return lit ? "glow" : "hairline";
  if (lit && (style === "off" || style === "hairline" || style === "ticks")) return "glow";
  if (!motion && (style === "scan" || style === "drip")) return "glow";
  return style;
}

export function ringPlan(
  look: NotchRingLook,
  { accent, glow, playback, motion, now }: { accent: string; glow: RingGlow; playback: RingPlayback; motion: boolean; now: number },
): RingPlan | null {
  const lit = ringLit(look, glow);
  if (look.style === "off" && !lit) return null;
  const playing = playback !== null && playback.durationMs > 0;
  const style = effectiveStyle(look.style, { lit, playing, motion });
  const color = lit && glow ? glow.color : ringColor(look, accent);
  const t = look.width;
  const k = look.intensity / 100;
  const pulse = lit && glow?.pulse === true;
  const glowAnimation: RingAnimation | undefined = motion ? (pulse ? "pulse" : "breathe") : undefined;
  const base = (opacity: number, width = t): RingLayer => ({ kind: "line", path: "ring", width, opacity, paint: "solid" });
  const layers: RingLayer[] = [];
  let progress: RingPlan["progress"] = null;

  switch (style) {
    case "hairline":
      layers.push(base(0.18 + k * 0.5));
      break;
    case "glow":
      layers.push({ kind: "line", path: "ring", width: t * 4, opacity: k, paint: "solid", blur: "wide", animation: glowAnimation });
      layers.push({ ...base(0.55 + k * 0.45), ...(pulse && motion && { animation: "pulse" as const }) });
      break;
    case "scan":
      layers.push(base(0.1 + k * 0.15));
      layers.push({ kind: "line", path: "ring", width: t * 5, opacity: k, paint: "solid", blur: "soft", dash: "120 3000", measured: true, animation: "scan" });
      layers.push({ kind: "line", path: "ring", width: t * 1.5, opacity: 1, paint: "white", dash: "120 3000", measured: true, animation: "scan" });
      break;
    case "drip":
      layers.push(base(0.1 + k * 0.15));
      for (const path of ["left", "right"] as const) {
        layers.push({ kind: "line", path, width: t * 4, opacity: k, paint: "solid", blur: "soft", dash: "300 3000", measured: true, animation: "twin" });
        layers.push({ kind: "line", path, width: t * 1.5, opacity: 1, paint: "solid", dash: "300 3000", measured: true, animation: "twin" });
      }
      layers.push({ kind: "drop", radius: 2 + t, opacity: 1, animation: "drip" });
      layers.push({ kind: "drop", radius: 5 + t * 2, opacity: k, blur: "soft", animation: "drip" });
      break;
    case "progress": {
      const durationMs = playback?.durationMs ?? 0;
      const elapsedMs = Math.min(Math.max(0, now - (playback?.startedAt ?? now)), durationMs);
      progress = { durationMs, elapsedMs };
      layers.push(base(0.12 + k * 0.12));
      layers.push({ kind: "line", path: "ring", width: t * 4, opacity: k, paint: "solid", blur: "soft", measured: true, animation: "progress" });
      layers.push({ kind: "line", path: "ring", width: t * 1.5, opacity: 1, paint: "solid", measured: true, animation: "progress" });
      break;
    }
    case "beat":
      layers.push({ kind: "line", path: "ring", width: t * 4, opacity: k, paint: "solid", blur: "wide", animation: motion ? "beat" : undefined });
      layers.push({ ...base(1, t * 1.5), animation: motion ? "beat" : undefined });
      break;
    case "ticks":
      layers.push(base(0.2 + k * 0.2, t * 0.6));
      layers.push({ kind: "line", path: "ticks", width: 3 + t, opacity: 0.35 + 0.6 * k, paint: "solid", dash: "1 5", animation: motion ? "turn" : undefined });
      break;
    case "aurora":
      layers.push({ kind: "line", path: "ring", width: t * 5, opacity: k, paint: "aurora", blur: "wide" });
      layers.push({ kind: "line", path: "ring", width: t * 1.3, opacity: 0.75 + k * 0.25, paint: "aurora" });
      break;
    case "off":
      return null;
  }
  return { style, color, lit, width: t, layers, auroraFlow: style === "aurora" && motion, progress };
}

export function ringShows(look: NotchRingLook, glow: RingGlow): boolean {
  return look.style !== "off" || ringLit(look, glow);
}
