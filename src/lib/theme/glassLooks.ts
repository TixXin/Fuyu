import { DEFAULT_GLASS_SETTINGS, type GlassSettingValues } from "../settings/glassSettings.ts";
import { DEFAULT_SETTINGS } from "../settings/settingsDefaults.ts";

export const GLASS_LOOKS = ["clear", "tinted", "flow", "material", "mica"] as const;
export type GlassLookId = (typeof GLASS_LOOKS)[number];

const LOOK_KEYS = [
  "glassStyle",
  "glassColorSource",
  "glassColorStrength",
  "glassFlowSpeed",
  "glassRim",
  "glassSheen",
  "glassSpecular",
  "glassMorph",
  "glassContrastGuard",
  "glassBackdrop",
  "glassBlur",
  "glassSaturation",
  "glassNoise",
] as const satisfies readonly (keyof GlassSettingValues)[];

export type GlassLook = Pick<GlassSettingValues, (typeof LOOK_KEYS)[number]> & { glassIntensity: number };

const flow: GlassLook = {
  ...(Object.fromEntries(LOOK_KEYS.map((key) => [key, DEFAULT_GLASS_SETTINGS[key]])) as Pick<GlassSettingValues, (typeof LOOK_KEYS)[number]>),
  glassIntensity: DEFAULT_SETTINGS.glassIntensity,
};
const still = { ...flow, glassStyle: "static", glassFlowSpeed: 0 } as const;

export const GLASS_LOOK_VALUES: Record<GlassLookId, GlassLook> = {
  clear: { ...still, glassColorStrength: 0, glassRim: true, glassContrastGuard: false, glassBlur: 4, glassSaturation: 190, glassNoise: 0, glassIntensity: 8 },
  tinted: { ...still, glassColorStrength: 70, glassRim: true, glassContrastGuard: false, glassBlur: 12, glassSaturation: 180, glassNoise: 0, glassIntensity: 28 },
  flow,
  material: { ...still, glassColorStrength: 0, glassRim: true, glassContrastGuard: false, glassBlur: 30, glassSaturation: 180, glassNoise: 3, glassIntensity: 52 },
  mica: { ...still, glassColorStrength: 0, glassRim: true, glassContrastGuard: false, glassBlur: 60, glassSaturation: 130, glassNoise: 2, glassIntensity: 72 },
};

export function glassLookOf(settings: GlassLook): GlassLookId | null {
  return GLASS_LOOKS.find((id) => {
    const look = GLASS_LOOK_VALUES[id];
    return settings.glassIntensity === look.glassIntensity && LOOK_KEYS.every((key) => settings[key] === look[key]);
  }) ?? null;
}
