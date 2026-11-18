import type { PushAgent, PushTarget, PushTargetState } from "./targets.ts";

export type PlannedProject = {
  key: string;
  targetId: string;
  agent: PushAgent;
  name: string;
  on: boolean;
};

export type TargetEntry = { target: PushTarget; state: PushTargetState | null };

export const PUSH_STEPS = 5;

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function projectNameValid(name: string) {
  return NAME_PATTERN.test(name);
}

export function defaultProjectName(slug: string, agent: PushAgent) {
  return `${slug}-${agent}`.slice(0, 64);
}

export function readyTargets(entries: readonly TargetEntry[]) {
  return entries.filter((entry) => Boolean(entry.state?.installed));
}

export function planProjects(entries: readonly TargetEntry[], previous: readonly PlannedProject[]): PlannedProject[] {
  const kept = new Map(previous.map((project) => [project.key, project]));
  return readyTargets(entries).flatMap(({ target, state }) =>
    (state?.agents ?? []).map((agent) => {
      const key = `${target.id}/${agent}`;
      return kept.get(key) ?? { key, targetId: target.id, agent, name: defaultProjectName(target.slug, agent), on: true };
    }),
  );
}

export function nameProblem(project: PlannedProject, plan: readonly PlannedProject[], taken: readonly string[]): "invalid" | "duplicate" | "taken" | null {
  if (!projectNameValid(project.name)) return "invalid";
  if (plan.some((other) => other.on && other.key !== project.key && other.targetId === project.targetId && other.name === project.name)) return "duplicate";
  if (taken.includes(project.name)) return "taken";
  return null;
}

export function chosenProjects(plan: readonly PlannedProject[], entries: readonly TargetEntry[], connected: ReadonlySet<string>, scanning: string | null = null) {
  return plan.filter((project) => {
    if (!project.on) return false;
    if (connected.has(project.key) || scanning === project.key) return true;
    const taken = entries.find((entry) => entry.target.id === project.targetId)?.state?.taken ?? [];
    return nameProblem(project, plan, taken) === null;
  });
}
