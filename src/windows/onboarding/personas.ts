import type { IslandSettings } from "../../features/appearance/types";

export const MODULES = ["todo", "music", "agents", "translation", "shelf", "mail", "screenshot", "clipboard"] as const;
export type OnboardingModule = (typeof MODULES)[number];

export const ISLAND_MODULE_KEYS = {
  todo: "todoEnabled",
  music: "musicEnabled",
  agents: "agentStatusEnabled",
  translation: "translationEnabled",
  shelf: "shelfEnabled",
  mail: "mailEnabled",
  screenshot: "screenshotEnabled",
} as const satisfies Record<Exclude<OnboardingModule, "clipboard">, keyof IslandSettings>;

export const PERSONAS = ["code", "office", "study", "fun"] as const;
export type Persona = (typeof PERSONAS)[number];

const PERSONA_MODULES: Record<Persona, readonly OnboardingModule[]> = {
  code: ["agents", "clipboard", "screenshot", "todo", "shelf"],
  office: ["todo", "mail", "clipboard", "translation", "screenshot", "shelf"],
  study: ["todo", "translation", "clipboard", "music"],
  fun: ["music", "shelf"],
};

export function modulesFor(personas: readonly Persona[]): Set<OnboardingModule> {
  return new Set(personas.flatMap((persona) => PERSONA_MODULES[persona]));
}

export function enabledModules(settings: IslandSettings, clipboardEnabled: boolean): Set<OnboardingModule> {
  return new Set(MODULES.filter((module) => (module === "clipboard" ? clipboardEnabled : settings[ISLAND_MODULE_KEYS[module]])));
}

export function withModules(settings: IslandSettings, modules: ReadonlySet<OnboardingModule>): IslandSettings {
  const next = { ...settings };
  for (const [module, key] of Object.entries(ISLAND_MODULE_KEYS)) {
    next[key as (typeof ISLAND_MODULE_KEYS)[keyof typeof ISLAND_MODULE_KEYS]] = modules.has(module as OnboardingModule);
  }
  return next;
}
