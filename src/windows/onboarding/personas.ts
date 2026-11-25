import type { BuiltinPlugin } from "../../features/plugin-kernel/api.ts";
import { builtinConfigBoolean, isBuiltinEnabled } from "../../features/plugin-kernel/builtinSwitches.ts";
import type { IslandSettings } from "../../lib/settings/types";
import type { IslandPage } from "../island/types";

export const MODULES = [
  "agents",
  "music",
  "todo",
  "calendar",
  "clipboard",
  "shelf",
  "screenshot",
  "translation",
  "timer",
  "voice",
  "mail",
] as const;

export type OnboardingModule = (typeof MODULES)[number];

export const ISLAND_MODULE_KEYS = {
  todo: "todoEnabled",
  music: "musicEnabled",
  agents: "agentStatusEnabled",
  translation: "translationEnabled",
  shelf: "shelfEnabled",
  mail: "mailEnabled",
  screenshot: "screenshotEnabled",
} as const satisfies Partial<Record<OnboardingModule, keyof IslandSettings>>;

export const MODULE_PLUGIN_IDS = {
  todo: "todos",
  calendar: "calendar",
  music: "music",
  agents: "agents",
  translation: "translation",
  shelf: "file-shelf",
  screenshot: "screenshot",
  clipboard: "clipboard",
  timer: "timer",
  voice: "voice-input",
} as const satisfies Record<Exclude<OnboardingModule, "mail">, string>;

export const MODULE_PREVIEW_PAGES: Partial<Record<OnboardingModule, IslandPage>> = {
  agents: "agents",
  music: "music",
  todo: "todo",
  calendar: "calendar",
  shelf: "shelf",
  timer: "timer",
  translation: "translation",
  clipboard: "clipboard",
};

export const PERSONAS = ["code", "office", "study", "fun"] as const;
export type Persona = (typeof PERSONAS)[number];

const PERSONA_MODULES: Record<Persona, readonly OnboardingModule[]> = {
  code: ["agents", "clipboard", "screenshot", "todo", "shelf", "timer"],
  office: ["todo", "calendar", "mail", "clipboard", "translation", "screenshot", "shelf"],
  study: ["todo", "calendar", "translation", "clipboard", "music", "timer", "voice"],
  fun: ["music", "shelf", "screenshot"],
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

export function enabledModules(
  settings: IslandSettings,
  clipboardEnabled: boolean,
  plugins: readonly BuiltinPlugin[] | null = null,
): Set<OnboardingModule> {
  return new Set(
    MODULES.filter((module) => {
      if (module === "clipboard") return isBuiltinEnabled(plugins, "clipboard", clipboardEnabled);
      if (module === "mail") {
        if (!isBuiltinEnabled(plugins, "messages", true)) return false;
        return builtinConfigBoolean(plugins, "messages", "mail") ?? settings.mailEnabled;
      }
      if (module === "calendar" || module === "timer" || module === "voice") {
        return isBuiltinEnabled(plugins, MODULE_PLUGIN_IDS[module], true);
      }
      return isBuiltinEnabled(plugins, MODULE_PLUGIN_IDS[module], settings[ISLAND_MODULE_KEYS[module]]);
    }),
  );
}

export function moduleSwitchChanges(
  before: ReadonlySet<OnboardingModule>,
  after: ReadonlySet<OnboardingModule>,
): { plugins: [string, boolean][]; mail?: boolean } {
  const plugins: [string, boolean][] = [];
  for (const [module, id] of Object.entries(MODULE_PLUGIN_IDS) as [Exclude<OnboardingModule, "mail">, string][]) {
    if (before.has(module) !== after.has(module)) plugins.push([id, after.has(module)]);
  }
  const mail = before.has("mail") !== after.has("mail") ? after.has("mail") : undefined;
  return { plugins, ...(mail === undefined ? {} : { mail }) };
}

export function withModules(settings: IslandSettings, modules: ReadonlySet<OnboardingModule>): IslandSettings {
  const next = { ...settings };
  for (const [module, key] of Object.entries(ISLAND_MODULE_KEYS)) {
    next[key as (typeof ISLAND_MODULE_KEYS)[keyof typeof ISLAND_MODULE_KEYS]] = modules.has(module as OnboardingModule);
  }
  return next;
}
