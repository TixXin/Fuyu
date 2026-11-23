import type { AgentSessions } from "@fuyu/plugin-services";
import type { PetInfo } from "./api";
import { dozeHour, nextDozeChange } from "../../components/jellyfish/jellyLively.ts";
import { CENTER_PATTERNS, type CenterMood, type CenterPatternId } from "./patterns.ts";

export const CENTER_PATTERN_OPTIONS = [...CENTER_PATTERNS, "pet"] as const;
export type CenterPatternSelection = (typeof CENTER_PATTERN_OPTIONS)[number];

export const CENTER_PATTERN_SIZE = { min: 16, max: 30, default: 24 } as const;

export const CENTER_CONFIG_DEFAULTS = {
  pattern: "eyes" as CenterPatternSelection,
  pet: "xiaoba",
  size: CENTER_PATTERN_SIZE.default,
} as const;

export type CenterConfigKey = keyof typeof CENTER_CONFIG_DEFAULTS;

export type CenterConfig = {
  pattern: CenterPatternSelection;
  pet: string;
  size: number;
};

export const PET_DONE_HOLD_MS = 3000;

export type CenterPatternChoice = { pattern: CenterPatternId; petId: null } | { pattern: "pet"; petId: string };

export function centerPatternSize(settings: Readonly<Record<string, unknown>>): number {
  const size = settings.size;
  return typeof size === "number" && Number.isFinite(size)
    ? Math.round(Math.min(CENTER_PATTERN_SIZE.max, Math.max(CENTER_PATTERN_SIZE.min, size)))
    : CENTER_PATTERN_SIZE.default;
}

export function centerConfig(raw: Readonly<Record<string, unknown>>): CenterConfig {
  const pattern = CENTER_PATTERN_OPTIONS.find((known) => known === raw.pattern) ?? CENTER_CONFIG_DEFAULTS.pattern;
  const pet = typeof raw.pet === "string" ? raw.pet.trim() : CENTER_CONFIG_DEFAULTS.pet;
  return { pattern, pet, size: centerPatternSize(raw) };
}

export function storedCenterValue(key: CenterConfigKey, value: string | number): string | number | null {
  if (key === "pattern") return value === CENTER_CONFIG_DEFAULTS.pattern ? null : value;
  if (key === "pet") {
    const trimmed = String(value).trim();
    return trimmed === CENTER_CONFIG_DEFAULTS.pet ? null : trimmed;
  }
  const clamped = centerPatternSize({ size: value });
  return clamped === CENTER_CONFIG_DEFAULTS.size ? null : clamped;
}

export function centerPatternChoice(settings: Readonly<Record<string, unknown>>): CenterPatternChoice {
  const { pattern, pet } = centerConfig(settings);
  if (pattern === "pet") return pet ? { pattern: "pet", petId: pet } : { pattern: "eyes", petId: null };
  return { pattern, petId: null };
}

export type AgentActivity = { phase: string; updatedAt: number; compacting?: boolean };

export function activityOf(answer: AgentSessions): AgentActivity[] {
  return [
    ...answer.sessions.map(({ phase, updatedAt, compacting }) => (compacting ? { phase, updatedAt, compacting } : { phase, updatedAt })),
    ...answer.others.map(({ phase, updatedAt }) => ({ phase, updatedAt })),
  ];
}

export function centerMoodFor(agents: readonly AgentActivity[], now: number, doze = false): CenterMood {
  const phases = new Set(agents.map((agent) => agent.phase));
  if (phases.has("waiting")) return "waiting";
  if (agents.some((agent) => agent.phase === "running" && !agent.compacting)) return "running";
  if (agents.some((agent) => agent.compacting)) return "compacting";
  if (phases.has("failed")) return "failed";
  if (phases.has("stale")) return "stale";
  if (agents.some((agent) => agent.phase === "completed" && isFresh(agent, now))) return "done";
  return doze && dozeHour(new Date(now).getHours()) ? "sleep" : "idle";
}

export function petMoodChangesAt(agents: readonly AgentActivity[], now: number): number | null {
  const ends = agents
    .filter((agent) => agent.phase === "completed" && isFresh(agent, now))
    .map((agent) => agent.updatedAt + PET_DONE_HOLD_MS);
  return ends.length > 0 ? Math.min(...ends) : null;
}

export function centerMoodChangesAt(agents: readonly AgentActivity[], now: number, doze: boolean): number | null {
  const done = petMoodChangesAt(agents, now);
  if (!doze) return done;
  return Math.min(done ?? Number.POSITIVE_INFINITY, nextDozeChange(now));
}

function isFresh(agent: AgentActivity, now: number) {
  return now - agent.updatedAt < PET_DONE_HOLD_MS && now >= agent.updatedAt;
}

export type PetList = readonly PetInfo[] | "loading" | "failed";

export function petChoices(
  pets: PetList,
  current: string,
  labels: { unset: string; none: string; failed: string; loading: string; missing: (id: string) => string; app: string },
): { value: string; label: string }[] {
  if (pets === "loading") return [{ value: current, label: labels.loading }];
  const list = pets === "failed" ? [] : pets;
  const unset = pets === "failed" ? labels.failed : list.length > 0 ? labels.unset : labels.none;
  const choices = [{ value: "", label: unset }];
  for (const pet of list)
    choices.push({ value: pet.id, label: pet.source === "app" ? `${pet.displayName} · ${labels.app}` : pet.displayName });
  if (current && !list.some((pet) => pet.id === current))
    choices.push({ value: current, label: pets === "failed" ? current : labels.missing(current) });
  return choices;
}
