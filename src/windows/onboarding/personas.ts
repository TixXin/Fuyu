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

export function personaModules(persona: Persona): readonly OnboardingModule[] {
  return PERSONA_MODULES[persona];
}

export type PersonaAnswer = { personas: readonly Persona[]; before: readonly OnboardingModule[] | null };

export const NO_ANSWER: PersonaAnswer = { personas: [], before: null };

export function togglePersona(answer: PersonaAnswer, persona: Persona, modules: ReadonlySet<OnboardingModule>): { answer: PersonaAnswer; modules: Set<OnboardingModule> } {
  const personas = answer.personas.includes(persona) ? answer.personas.filter((chosen) => chosen !== persona) : [...answer.personas, persona];
  const before = answer.before ?? MODULES.filter((module) => modules.has(module));
  if (personas.length === 0) return { answer: NO_ANSWER, modules: new Set(before) };
  return { answer: { personas, before }, modules: modulesFor(personas) };
}

export function takenOff(answer: PersonaAnswer, modules: ReadonlySet<OnboardingModule>): OnboardingModule[] {
  return (answer.before ?? []).filter((module) => !modules.has(module));
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
