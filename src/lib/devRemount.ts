export const REMOUNT_FIRST_DELAY_MS = 3000;
export const REMOUNT_MAX_ATTEMPTS = 5;
export const REMOUNT_QUIET_MS = 1500;

export function parseRemountAttempts(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function remountDelay(attempts: number): number | null {
  if (attempts >= REMOUNT_MAX_ATTEMPTS) return null;
  return REMOUNT_FIRST_DELAY_MS * 2 ** Math.max(0, attempts);
}

export type RemountStep = { kind: "stop" } | { kind: "wait"; ms: number } | { kind: "reload" };

export function nextRemountStep(state: { mounted: boolean; sinceLastLoadMs: number }): RemountStep {
  if (state.mounted) return { kind: "stop" };
  if (state.sinceLastLoadMs < REMOUNT_QUIET_MS) return { kind: "wait", ms: REMOUNT_QUIET_MS - state.sinceLastLoadMs };
  return { kind: "reload" };
}
