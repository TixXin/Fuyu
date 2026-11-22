import type { NotchRimColor, NotchRimLook } from "../../../lib/settings/notchRimSettings.ts";

export type RimPath = "rim" | "rimLeft" | "rimRight";
export type RimBlur = "soft" | "wide";
export type RimAnimation = "breathe" | "pulse" | "comet-tail" | "comet-head" | "twin" | "flash" | "ripple";
export type RimPaint = "solid" | "aurora" | "under";

export type RimStroke = {
  kind: "stroke";
  path: RimPath;
  paint: RimPaint;
  color: string;
  width: number;
  opacity: number;
  clip?: boolean;
  blur?: RimBlur;
  dash?: number;
  animation?: RimAnimation;
};

export type RimGlowSpot = {
  kind: "spot";
  at: "bottom";
  rx: number;
  ry: number;
  color: string;
  opacity: number;
  blur: RimBlur;
  animation?: RimAnimation;
};

export type RimLayer = RimStroke | RimGlowSpot;

export type RimStatus = { color: string; pulse?: boolean } | null;

export function rimStatusOf(glow: { color: string; pulse?: boolean; reason: string } | null): RimStatus {
  if (!glow || glow.reason.startsWith("device-use.")) return null;
  return glow.pulse ? { color: glow.color, pulse: true } : { color: glow.color };
}

export type RimPlan = {
  layers: RimLayer[];
  color: string;
  width: number;
  duration: number;
  auroraFlow: boolean;
};

export const RIM_PALETTE: Record<Exclude<NotchRimColor, "accent" | "custom">, string> = {
  white: "#ffffff",
  violet: "#bf5af2",
  pink: "#ff375f",
  mint: "#63e6be",
};

export const AURORA_COLORS = ["#5ac8fa", "#bf5af2", "#ff375f", "#ff9f0a", "#63e6be", "#5ac8fa"] as const;

export function rimColor(look: Pick<NotchRimLook, "color" | "customColor">, accent: string) {
  if (look.color === "accent") return accent;
  if (look.color === "custom") return look.customColor;
  return RIM_PALETTE[look.color];
}

export function rimShown(look: NotchRimLook) {
  return look.style !== "off";
}

export function rimDuration(length: number) {
  return Math.max(2.6, length / 110);
}

export function rimPlan(look: NotchRimLook, opts: { accent: string; status: RimStatus; motion: boolean; length: number; width: number; ripple: boolean }): RimPlan {
  const statusOn = look.status && opts.status !== null;
  const style = statusOn && look.style === "hairline" ? "glow" : look.style;
  const color = statusOn && opts.status ? opts.status.color : rimColor(look, opts.accent);
  const t = look.width;
  const k = look.intensity / 100;
  const motion = look.motion && opts.motion;
  const breathe: RimAnimation | undefined = motion ? (statusOn && opts.status?.pulse ? "pulse" : "breathe") : undefined;
  const stroke = (part: Omit<RimStroke, "kind" | "path" | "paint" | "color"> & Partial<Pick<RimStroke, "path" | "paint" | "color">>): RimStroke => ({
    kind: "stroke",
    path: "rim",
    paint: "solid",
    color,
    ...part,
  });
  const base = (width: number, opacity: number, paint: RimPaint = "solid") => stroke({ width, opacity, clip: true, paint });
  const glow = (width: number, opacity: number, blur: RimBlur, animation?: RimAnimation, paint: RimPaint = "solid") =>
    stroke({ width, opacity, blur, paint, ...(animation && { animation }) });
  const layers: RimLayer[] = [];

  if (style === "hairline") {
    layers.push(base(t * 2, 0.12 + k * 0.5));
  } else if (style === "glow") {
    layers.push(glow(t * 3, k, "soft", breathe), base(t * 2, 0.55 + k * 0.45));
  } else if (style === "comet" && motion) {
    layers.push(
      base(t * 2, 0.08 + k * 0.14),
      stroke({ width: t * 2.4, opacity: 0.35 * k + 0.15, clip: true, dash: 180, animation: "comet-tail" }),
      stroke({ width: t * 5, opacity: k, blur: "soft", dash: 40, animation: "comet-head" }),
      stroke({ width: t * 2, opacity: 0.6 + 0.4 * k, clip: true, dash: 40, animation: "comet-head", color: "#ffffff" }),
    );
  } else if (style === "twin" && motion) {
    layers.push(base(t * 2, 0.08 + k * 0.14));
    for (const path of ["rimLeft", "rimRight"] as const) {
      layers.push(
        stroke({ path, width: t * 4, opacity: k, blur: "soft", dash: 260, animation: "twin" }),
        stroke({ path, width: t * 2, opacity: 1, clip: true, dash: 260, animation: "twin" }),
      );
    }
    layers.push({ kind: "spot", at: "bottom", rx: Math.min(70, opts.width * 0.18), ry: 5 + 6 * k, color, opacity: 1, blur: "wide", animation: "flash" });
  } else if (style === "comet" || style === "twin") {
    layers.push(glow(t * 3, k * 0.8, "soft"), base(t * 2, 0.5 + k * 0.4));
  } else if (style === "aurora") {
    layers.push(glow(t * 4, k, "wide", undefined, "aurora"), base(t * 2, 0.7 + k * 0.3, "aurora"));
  } else if (style === "under") {
    layers.push(
      { kind: "spot", at: "bottom", rx: opts.width * 0.36, ry: 4 + 7 * k, color, opacity: 0.35 + 0.55 * k, blur: "wide", ...(breathe && { animation: breathe }) },
      base(t * 2, 0.5 + k * 0.5, "under"),
    );
  }

  if (opts.ripple && statusOn && motion) {
    layers.push(stroke({ width: 2, opacity: 0, blur: "soft", animation: "ripple" }));
  }

  return { layers, color, width: t, duration: rimDuration(opts.length), auroraFlow: style === "aurora" && motion };
}
