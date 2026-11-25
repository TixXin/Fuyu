import { notchRimLook, withNotchRimLook, type NotchRimLook, type NotchRimSettingValues, type NotchRimStyle } from "./notchRimSettings.ts";
import { notchRingLook, withNotchRingLook, type NotchRingLook, type NotchRingSettingValues, type NotchRingStyle } from "./notchRingSettings.ts";

export type NotchSettings = NotchRimSettingValues & NotchRingSettingValues;
export type NotchState = "collapsed" | "expanded";
export type NotchLayer = "rim" | "ring";
export type NotchTarget = "Island" | "Panel";

export const NOTCH_COLORS = ["white", "accent", "violet", "pink", "mint", "custom"] as const;
export type NotchColor = (typeof NOTCH_COLORS)[number];

export const NOTCH_WIDTH_LEVELS = { thin: 1, medium: 1.5, thick: 2.5 } as const;
export type NotchWidthLevel = keyof typeof NOTCH_WIDTH_LEVELS;

export type NotchShared = { color: NotchColor; customColor: string; width: number; intensity: number; motion: boolean };
export type NotchLights = { device: boolean; status: boolean };

const TARGETS = ["Island", "Panel"] as const satisfies readonly NotchTarget[];

export function notchLinked(settings: NotchSettings): boolean {
  return settings.notchRimPanelSame && settings.notchRingPanelSame;
}

export function notchTargetOf(state: NotchState): NotchTarget {
  return state === "collapsed" ? "Island" : "Panel";
}

export function notchEditTarget(settings: NotchSettings, state: NotchState): NotchTarget {
  return notchLinked(settings) ? "Island" : notchTargetOf(state);
}

export function notchStyles(settings: NotchSettings, state: NotchState): { rim: NotchRimStyle; ring: NotchRingStyle } {
  const target = notchTargetOf(state);
  return { rim: notchRimLook(settings, target).style, ring: notchRingLook(settings, target).style };
}

export function notchShared(settings: NotchSettings): NotchShared {
  const ring = notchRingLook(settings, "Island");
  return { color: ring.color, customColor: ring.customColor, width: ring.width, intensity: ring.intensity, motion: ring.motion };
}

function writeRim<S extends NotchSettings>(settings: S, target: NotchTarget, patch: Partial<NotchRimLook>): S {
  return { ...settings, ...withNotchRimLook(settings, target, patch) };
}

function writeRing<S extends NotchSettings>(settings: S, target: NotchTarget, patch: Partial<NotchRingLook>): S {
  return { ...settings, ...withNotchRingLook(settings, target, patch) };
}

export function withNotchShared<S extends NotchSettings>(settings: S, patch: Partial<NotchShared>): S {
  let next = settings;
  for (const target of TARGETS) {
    next = writeRim(next, target, patch);
    next = writeRing(next, target, patch);
  }
  return next;
}

export function withNotchStyle<S extends NotchSettings>(settings: S, layer: NotchLayer, state: NotchState, style: NotchRimStyle | NotchRingStyle): S {
  const target = notchEditTarget(settings, state);
  const shared = notchShared(settings);
  if (layer === "rim") return writeRim(settings, target, { ...shared, style: style as NotchRimStyle });
  return writeRing(settings, target, { ...shared, style: style as NotchRingStyle });
}

export function withNotchLinked<S extends NotchSettings>(settings: S, linked: boolean, from: NotchState = "collapsed"): S {
  if (linked) {
    const source = from === "expanded" && !notchLinked(settings)
      ? writeRing(writeRim(settings, "Island", notchRimLook(settings, "Panel")), "Island", { ...notchRingLook(settings, "Panel"), device: false })
      : settings;
    return { ...source, notchRimPanelSame: true, notchRingPanelSame: true };
  }
  const rim = notchRimLook(settings, "Island");
  const ring = notchRingLook(settings, "Island");
  const copied = writeRing(writeRim(settings, "Panel", rim), "Panel", { ...ring, device: settings.notchRingPanelDevice });
  return { ...copied, notchRimPanelSame: false, notchRingPanelSame: false };
}

export function notchLights(settings: NotchSettings): NotchLights {
  return {
    device: notchRingLook(settings, "Panel").device,
    status: notchRingLook(settings, "Island").status,
  };
}

export function withNotchLights<S extends NotchSettings>(settings: S, patch: Partial<NotchLights>): S {
  let next = settings;
  if (patch.device !== undefined) {
    next = writeRing(next, "Island", { device: false });
    next = writeRing(next, "Panel", { device: patch.device });
  }
  if (patch.status !== undefined) {
    for (const target of TARGETS) {
      next = writeRing(next, target, { status: patch.status });
      next = writeRim(next, target, { status: patch.status });
    }
  }
  return next;
}

export function notchGap(settings: NotchSettings): number {
  return notchRingLook(settings, "Island").gap;
}

export function withNotchGap<S extends NotchSettings>(settings: S, gap: number): S {
  return writeRing(writeRing(settings, "Island", { gap }), "Panel", { gap });
}

export function nearestWidthLevel(width: number): NotchWidthLevel {
  let best: NotchWidthLevel = "thin";
  for (const level of Object.keys(NOTCH_WIDTH_LEVELS) as NotchWidthLevel[]) {
    if (Math.abs(NOTCH_WIDTH_LEVELS[level] - width) < Math.abs(NOTCH_WIDTH_LEVELS[best] - width)) best = level;
  }
  return best;
}
