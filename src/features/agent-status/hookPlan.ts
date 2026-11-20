import type { AgentHooksState, HookInstallState } from "./api";

export type HookWork = { fix: string[]; install: string[]; scriptsOutdated: boolean };

export type AutoHookOptions = { install: boolean; update: boolean };

export function hookStateOf(state: AgentHooksState | null, provider: string): HookInstallState | undefined {
  if (!state || provider === "scriptsOutdated") return undefined;
  return (state as Partial<Record<string, HookInstallState>>)[provider];
}

export function isHookInstalled(value: HookInstallState | undefined) {
  return value === "current" || value === "outdated";
}

export function hookWork(state: AgentHooksState | null, providers: readonly string[], hidden: readonly string[]): HookWork {
  const enabled = providers.filter((provider) => !hidden.includes(provider));
  return {
    fix: enabled.filter((provider) => hookStateOf(state, provider) === "outdated"),
    install: enabled.filter((provider) => hookStateOf(state, provider) === "notInstalled"),
    scriptsOutdated: state?.scriptsOutdated === true,
  };
}

export function anyHookInstalled(state: AgentHooksState | null, providers: readonly string[]) {
  return providers.some((provider) => isHookInstalled(hookStateOf(state, provider)));
}

export function repairTargets(state: AgentHooksState | null, providers: readonly string[], hidden: readonly string[]) {
  const work = hookWork(state, providers, hidden);
  if (work.fix.length > 0 || !work.scriptsOutdated) return work.fix;
  return providers.filter((provider) => !hidden.includes(provider) && isHookInstalled(hookStateOf(state, provider))).slice(0, 1);
}

export function autoHookTargets(
  state: AgentHooksState | null,
  providers: readonly string[],
  hidden: readonly string[],
  options: AutoHookOptions,
  tried: ReadonlySet<string>,
) {
  if (!state || !anyHookInstalled(state, providers)) return [];
  const work = hookWork(state, providers, hidden);
  const targets = [
    ...(options.update ? repairTargets(state, providers, hidden) : []),
    ...(options.install ? work.install : []),
  ];
  return [...new Set(targets)].filter((provider) => !tried.has(autoHookKey(state, provider)));
}

export function autoHookKey(state: AgentHooksState | null, provider: string) {
  return `${provider}:${hookStateOf(state, provider) ?? "unknown"}:${state?.scriptsOutdated === true}`;
}
