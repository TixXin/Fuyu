import { clamp } from "../../utils/number.ts";
import { HEX_COLOR_PATTERN } from "../../utils/color.ts";
import { oneOf } from "./settingsLimits.ts";

export const NOTCH_RING_STYLES = ["off", "hairline", "glow", "scan", "drip", "progress", "beat", "ticks", "aurora"] as const;
export const NOTCH_RING_COLORS = ["white", "accent", "violet", "pink", "mint", "custom"] as const;
export const NOTCH_RING_TARGETS = ["Island", "Panel"] as const;
export const NOTCH_RING_BOTTOMS = ["sides", "full"] as const;

export type NotchRingStyle = (typeof NOTCH_RING_STYLES)[number];
export type NotchRingColor = (typeof NOTCH_RING_COLORS)[number];
export type NotchRingTarget = (typeof NOTCH_RING_TARGETS)[number];
export type NotchRingBottom = (typeof NOTCH_RING_BOTTOMS)[number];

export const NOTCH_RING_WIDTH = { min: 0.5, max: 3, step: 0.5 } as const;
export const NOTCH_RING_GAP = { min: 0, max: 6 } as const;
export const NOTCH_RING_INTENSITY = { min: 10, max: 100 } as const;

export type NotchRingLook = {
  style: NotchRingStyle;
  color: NotchRingColor;
  customColor: string;
  width: number;
  gap: number;
  intensity: number;
  motion: boolean;
  device: boolean;
  status: boolean;
};

type Capitalized<K extends string> = K extends `${infer First}${infer Rest}` ? `${Uppercase<First>}${Rest}` : K;
type RingKeys<T extends NotchRingTarget> = { [K in keyof NotchRingLook as `notchRing${T}${Capitalized<K & string>}`]: NotchRingLook[K] };

export type NotchRingSettingValues = RingKeys<"Island"> & RingKeys<"Panel"> & { notchRingPanelSame: boolean; notchRingIslandBottom: NotchRingBottom };

const FIELDS = ["style", "color", "customColor", "width", "gap", "intensity", "motion", "device", "status"] as const satisfies readonly (keyof NotchRingLook)[];

export function notchRingKey<T extends NotchRingTarget, F extends keyof NotchRingLook>(target: T, field: F) {
  return `notchRing${target}${field.charAt(0).toUpperCase()}${field.slice(1)}` as keyof RingKeys<T> & keyof NotchRingSettingValues;
}

export const NOTCH_RING_SETTING_KEYS = [
  ...NOTCH_RING_TARGETS.flatMap((target) => FIELDS.map((field) => notchRingKey(target, field))),
  "notchRingPanelSame",
  "notchRingIslandBottom",
] as const satisfies readonly (keyof NotchRingSettingValues)[];

const DEFAULT_LOOKS: Record<NotchRingTarget, NotchRingLook> = {
  Island: { style: "off", color: "white", customColor: "#ffd60a", width: 1, gap: 2, intensity: 60, motion: true, device: true, status: false },
  Panel: { style: "off", color: "white", customColor: "#ffd60a", width: 1, gap: 3, intensity: 45, motion: true, device: true, status: false },
};

function flatten(target: NotchRingTarget, look: NotchRingLook) {
  return Object.fromEntries(FIELDS.map((field) => [notchRingKey(target, field), look[field]]));
}

export const DEFAULT_NOTCH_RING_SETTINGS = {
  ...flatten("Island", DEFAULT_LOOKS.Island),
  ...flatten("Panel", DEFAULT_LOOKS.Panel),
  notchRingPanelSame: false,
  notchRingIslandBottom: "sides",
} as NotchRingSettingValues;

export function notchRingLook(settings: NotchRingSettingValues, target: NotchRingTarget): NotchRingLook {
  const from = target === "Panel" && settings.notchRingPanelSame ? "Island" : target;
  return Object.fromEntries(FIELDS.map((field) => [field, settings[notchRingKey(from, field)]])) as NotchRingLook;
}

export function withNotchRingLook(settings: NotchRingSettingValues, target: NotchRingTarget, patch: Partial<NotchRingLook>): NotchRingSettingValues {
  const next: Record<string, unknown> = { ...settings };
  for (const [field, value] of Object.entries(patch)) next[notchRingKey(target, field as keyof NotchRingLook)] = value;
  return next as NotchRingSettingValues;
}

function readNumber(value: unknown, range: { min: number; max: number }, step: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value / step) * step, range.min, range.max) : fallback;
}

function normalizeLook(saved: Record<string, unknown> | null | undefined, target: NotchRingTarget): NotchRingLook {
  const fallback = DEFAULT_LOOKS[target];
  const read = (field: keyof NotchRingLook) => saved?.[notchRingKey(target, field)];
  const custom = read("customColor");
  const flag = (field: "motion" | "device" | "status") => (typeof read(field) === "boolean" ? read(field) as boolean : fallback[field]);
  return {
    style: oneOf(NOTCH_RING_STYLES, read("style"), fallback.style),
    color: oneOf(NOTCH_RING_COLORS, read("color"), fallback.color),
    customColor: typeof custom === "string" && HEX_COLOR_PATTERN.test(custom) ? custom : fallback.customColor,
    width: readNumber(read("width"), NOTCH_RING_WIDTH, NOTCH_RING_WIDTH.step, fallback.width),
    gap: readNumber(read("gap"), NOTCH_RING_GAP, 1, fallback.gap),
    intensity: readNumber(read("intensity"), NOTCH_RING_INTENSITY, 1, fallback.intensity),
    motion: flag("motion"),
    device: flag("device"),
    status: flag("status"),
  };
}

export function normalizeNotchRingSettings(saved: object | null | undefined): NotchRingSettingValues {
  const record = saved as Record<string, unknown> | null | undefined;
  return {
    ...flatten("Island", normalizeLook(record, "Island")),
    ...flatten("Panel", normalizeLook(record, "Panel")),
    notchRingPanelSame: record?.notchRingPanelSame === true,
    notchRingIslandBottom: oneOf(NOTCH_RING_BOTTOMS, record?.notchRingIslandBottom, "sides"),
  } as NotchRingSettingValues;
}

export function notchRingExtra(settings: NotchRingSettingValues, lit: boolean, collapsedScale = 1): number {
  const look = notchRingLook(settings, "Island");
  if (settings.notchRingIslandBottom !== "full" || (look.style === "off" && !lit)) return 0;
  return Math.ceil((look.gap + look.width + 2) / Math.max(collapsedScale, 0.01));
}
