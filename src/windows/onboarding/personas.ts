// The guide's modules and the "what do you mostly use the computer for" answers (act 3). Pure, so
// tests/unit/onboarding-personas.test.mjs can load it directly.
import type { IslandSettings } from "../../features/appearance/types";

/** The modules the guide lists, in the order the stickers show. */
export const MODULES = ["todo", "music", "agents", "translation", "shelf", "mail", "screenshot", "clipboard"] as const;
export type OnboardingModule = (typeof MODULES)[number];

/** Modules kept in the island's settings; clipboard history is in its own store. */
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

/** The modules for the chosen answers: every module any of them uses. None chosen gives none. */
export function modulesFor(personas: readonly Persona[]): Set<OnboardingModule> {
  return new Set(personas.flatMap((persona) => PERSONA_MODULES[persona]));
}

/** Which modules are on now. */
export function enabledModules(settings: IslandSettings, clipboardEnabled: boolean): Set<OnboardingModule> {
  return new Set(MODULES.filter((module) => (module === "clipboard" ? clipboardEnabled : settings[ISLAND_MODULE_KEYS[module]])));
}

/** The island's settings with exactly these modules on (clipboard history is left to its store). */
export function withModules(settings: IslandSettings, modules: ReadonlySet<OnboardingModule>): IslandSettings {
  const next = { ...settings };
  for (const [module, key] of Object.entries(ISLAND_MODULE_KEYS)) {
    next[key as (typeof ISLAND_MODULE_KEYS)[keyof typeof ISLAND_MODULE_KEYS]] = modules.has(module as OnboardingModule);
  }
  return next;
}
