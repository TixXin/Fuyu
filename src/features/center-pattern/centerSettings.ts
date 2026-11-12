import type { PetInfo } from "./api";
import { CENTER_PATTERNS, type CenterPatternId, type PetMood } from "./patterns.ts";

export const CENTER_PATTERN_PLUGIN_ID = "focusd.center-pattern";
export const CENTER_PATTERN_PET_KEY = "pet";
export const PET_DONE_HOLD_MS = 3000;

export type CenterPatternChoice = { pattern: CenterPatternId; petId: null } | { pattern: "pet"; petId: string };

export function centerPatternChoice(settings: Record<string, unknown>): CenterPatternChoice {
  const pattern = settings.pattern;
  const petId = typeof settings[CENTER_PATTERN_PET_KEY] === "string" ? (settings[CENTER_PATTERN_PET_KEY] as string).trim() : "";
  if (pattern === "pet") return petId ? { pattern: "pet", petId } : { pattern: "eyes", petId: null };
  return { pattern: CENTER_PATTERNS.find((known) => known === pattern) ?? "eyes", petId: null };
}

export function centerPatternSize(settings: Record<string, unknown>): number {
  const size = settings.size;
  return typeof size === "number" && Number.isFinite(size) ? Math.round(Math.min(30, Math.max(16, size))) : 24;
}

export type AgentActivity = { phase: string; updatedAt: number };

export function petMoodFor(agents: readonly AgentActivity[], now: number): PetMood {
  const phases = new Set(agents.map((agent) => agent.phase));
  if (phases.has("waiting")) return "waiting";
  if (phases.has("running")) return "running";
  if (phases.has("failed") || phases.has("stale")) return "failed";
  return agents.some((agent) => agent.phase === "completed" && isFresh(agent, now)) ? "done" : "idle";
}

export function petMoodChangesAt(agents: readonly AgentActivity[], now: number): number | null {
  const ends = agents
    .filter((agent) => agent.phase === "completed" && isFresh(agent, now))
    .map((agent) => agent.updatedAt + PET_DONE_HOLD_MS);
  return ends.length > 0 ? Math.min(...ends) : null;
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
