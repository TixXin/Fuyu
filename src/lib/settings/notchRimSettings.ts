import { clamp } from "../../utils/number.ts";
import { HEX_COLOR_PATTERN } from "../../utils/color.ts";
import { oneOf } from "./settingsLimits.ts";

export const NOTCH_RIM_STYLES = ["off", "hairline", "glow", "comet", "twin", "aurora", "under"] as const;
export const NOTCH_RIM_COLORS = ["accent", "white", "violet", "pink", "mint", "custom"] as const;
export const NOTCH_RIM_TARGETS = ["Island", "Panel"] as const;

export type NotchRimStyle = (typeof NOTCH_RIM_STYLES)[number];
export type NotchRimColor = (typeof NOTCH_RIM_COLORS)[number];
export type NotchRimTarget = (typeof NOTCH_RIM_TARGETS)[number];

export const NOTCH_RIM_WIDTH = { min: 0.5, max: 3, step: 0.5 } as const;
export const NOTCH_RIM_INTENSITY = { min: 10, max: 100 } as const;

export type NotchRimLook = {
  style: NotchRimStyle;
  color: NotchRimColor;
  customColor: string;
  width: number;
  intensity: number;
  motion: boolean;
  status: boolean;
};

type Capitalized<K extends string> = K extends `${infer First}${infer Rest}` ? `${Uppercase<First>}${Rest}` : K;
type RimKeys<T extends NotchRimTarget> = { [K in keyof NotchRimLook as `notchRim${T}${Capitalized<K & string>}`]: NotchRimLook[K] };

export type NotchRimSettingValues = RimKeys<"Island"> & RimKeys<"Panel"> & { notchRimPanelSame: boolean };

const FIELDS = ["style", "color", "customColor", "width", "intensity", "motion", "status"] as const satisfies readonly (keyof NotchRimLook)[];

export function notchRimKey<T extends NotchRimTarget, F extends keyof NotchRimLook>(target: T, field: F) {
  return `notchRim${target}${field.charAt(0).toUpperCase()}${field.slice(1)}` as keyof RimKeys<T> & keyof NotchRimSettingValues;
}

export const NOTCH_RIM_SETTING_KEYS = [
  ...NOTCH_RIM_TARGETS.flatMap((target) => FIELDS.map((field) => notchRimKey(target, field))),
  "notchRimPanelSame",
] as const satisfies readonly (keyof NotchRimSettingValues)[];

const DEFAULT_LOOKS: Record<NotchRimTarget, NotchRimLook> = {
  Island: { style: "off", color: "accent", customColor: "#ffd60a", width: 1.5, intensity: 70, motion: true, status: false },
  Panel: { style: "off", color: "white", customColor: "#ffd60a", width: 1, intensity: 45, motion: true, status: false },
};

function flatten(target: NotchRimTarget, look: NotchRimLook) {
  return Object.fromEntries(FIELDS.map((field) => [notchRimKey(target, field), look[field]]));
}

export const DEFAULT_NOTCH_RIM_SETTINGS = {
  ...flatten("Island", DEFAULT_LOOKS.Island),
  ...flatten("Panel", DEFAULT_LOOKS.Panel),
  notchRimPanelSame: false,
} as NotchRimSettingValues;

export function notchRimLook(settings: NotchRimSettingValues, target: NotchRimTarget): NotchRimLook {
  const from = target === "Panel" && settings.notchRimPanelSame ? "Island" : target;
  return Object.fromEntries(FIELDS.map((field) => [field, settings[notchRimKey(from, field)]])) as NotchRimLook;
}

export function withNotchRimLook(settings: NotchRimSettingValues, target: NotchRimTarget, patch: Partial<NotchRimLook>): NotchRimSettingValues {
  const next: Record<string, unknown> = { ...settings };
  for (const [field, value] of Object.entries(patch)) next[notchRimKey(target, field as keyof NotchRimLook)] = value;
  return next as NotchRimSettingValues;
}

function normalizeLook(saved: Record<string, unknown> | null | undefined, target: NotchRimTarget): NotchRimLook {
  const fallback = DEFAULT_LOOKS[target];
  const read = (field: keyof NotchRimLook) => saved?.[notchRimKey(target, field)];
  const width = read("width");
  const intensity = read("intensity");
  const custom = read("customColor");
  return {
    style: oneOf(NOTCH_RIM_STYLES, read("style"), fallback.style),
    color: oneOf(NOTCH_RIM_COLORS, read("color"), fallback.color),
    customColor: typeof custom === "string" && HEX_COLOR_PATTERN.test(custom) ? custom : fallback.customColor,
    width: typeof width === "number" && Number.isFinite(width)
      ? clamp(Math.round(width / NOTCH_RIM_WIDTH.step) * NOTCH_RIM_WIDTH.step, NOTCH_RIM_WIDTH.min, NOTCH_RIM_WIDTH.max)
      : fallback.width,
    intensity: typeof intensity === "number" && Number.isFinite(intensity)
      ? clamp(Math.round(intensity), NOTCH_RIM_INTENSITY.min, NOTCH_RIM_INTENSITY.max)
      : fallback.intensity,
    motion: read("motion") !== false,
    status: read("status") === true,
  };
}

export function normalizeNotchRimSettings(saved: object | null | undefined): NotchRimSettingValues {
  const record = saved as Record<string, unknown> | null | undefined;
  return {
    ...flatten("Island", normalizeLook(record, "Island")),
    ...flatten("Panel", normalizeLook(record, "Panel")),
    notchRimPanelSame: record?.notchRimPanelSame === true,
  } as NotchRimSettingValues;
}
