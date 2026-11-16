export type FirstHintId = "agent" | "message" | "tuck";

export const FIRST_HINT_IDS: readonly FirstHintId[] = ["agent", "message", "tuck"];
export const MAX_SHOWINGS = 3;

export type FirstHintsState = {
  dismissed: FirstHintId[];
  shown: Partial<Record<FirstHintId, number>>;
  lastShownAt: number;
};

export const EMPTY_FIRST_HINTS: FirstHintsState = { dismissed: [], shown: {}, lastShownAt: 0 };

function isHintId(value: unknown): value is FirstHintId {
  return typeof value === "string" && (FIRST_HINT_IDS as readonly string[]).includes(value);
}

export function normalizeFirstHints(value: unknown): FirstHintsState {
  if (!value || typeof value !== "object") return EMPTY_FIRST_HINTS;
  const raw = value as Record<string, unknown>;
  const dismissed = Array.isArray(raw.dismissed) ? [...new Set(raw.dismissed.filter(isHintId))] : [];
  const shown: Partial<Record<FirstHintId, number>> = {};
  if (raw.shown && typeof raw.shown === "object") {
    for (const [id, count] of Object.entries(raw.shown as Record<string, unknown>)) {
      if (isHintId(id) && typeof count === "number" && Number.isFinite(count) && count > 0) shown[id] = Math.floor(count);
    }
  }
  const lastShownAt = typeof raw.lastShownAt === "number" && Number.isFinite(raw.lastShownAt) && raw.lastShownAt > 0 ? raw.lastShownAt : 0;
  return { dismissed, shown, lastShownAt };
}

export function isRetired(state: FirstHintsState, id: FirstHintId) {
  return state.dismissed.includes(id) || (state.shown[id] ?? 0) >= MAX_SHOWINGS;
}

export function sameLocalDay(a: number, b: number) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function nextFirstHint(state: FirstHintsState, pending: readonly FirstHintId[], now: number): FirstHintId | null {
  if (state.lastShownAt > 0 && sameLocalDay(state.lastShownAt, now)) return null;
  return pending.find((id) => !isRetired(state, id)) ?? null;
}

export function markFirstHintShown(state: FirstHintsState, id: FirstHintId, now: number): FirstHintsState {
  return { ...state, shown: { ...state.shown, [id]: (state.shown[id] ?? 0) + 1 }, lastShownAt: now };
}

export function markFirstHintDismissed(state: FirstHintsState, id: FirstHintId): FirstHintsState {
  return state.dismissed.includes(id) ? state : { ...state, dismissed: [...state.dismissed, id] };
}
