export const BAR_HEIGHT = 38;
export const MAX_GROWN_HEIGHT = 92;
export const FIT_ROUNDS = 3;
const FIT_SLACK = 2;

export type SummaryGrow = { width: number; height: number };

export type FitState = { extra: number; wrap: boolean; rounds: number; lastAvailable: number; height: number };

export type FitMeasure = { deficit: number; available: number; chrome: number; content: number };

export const INITIAL_FIT: FitState = { extra: 0, wrap: false, rounds: 0, lastAvailable: -1, height: BAR_HEIGHT };

export function stepFit(state: FitState, measure: FitMeasure): FitState {
  if (!state.wrap) {
    if (measure.deficit <= 1) return state;
    const stuck = state.rounds > 0 && measure.available <= state.lastAvailable + 1;
    if (stuck || state.rounds >= FIT_ROUNDS) return { ...state, wrap: true };
    return { ...state, extra: state.extra + Math.ceil(measure.deficit) + FIT_SLACK, rounds: state.rounds + 1, lastAvailable: measure.available };
  }
  const wanted = Math.ceil(measure.chrome + measure.content);
  const height = Math.min(MAX_GROWN_HEIGHT, Math.max(BAR_HEIGHT, wanted));
  return height === state.height ? state : { ...state, height };
}

export function fitGrow(state: FitState): SummaryGrow | null {
  return state.extra > 0 || state.height > BAR_HEIGHT ? { width: state.extra, height: state.height } : null;
}

export function sameGrow(a: SummaryGrow | null, b: SummaryGrow | null) {
  return a === b || (a !== null && b !== null && a.width === b.width && a.height === b.height);
}

export function createSummaryGrowStore() {
  let value: SummaryGrow | null = null;
  const listeners = new Set<() => void>();
  const set = (next: SummaryGrow | null) => {
    if (sameGrow(next, value)) return;
    value = next;
    listeners.forEach((listener) => listener());
  };
  return {
    get: () => value,
    set,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const summaryGrow = createSummaryGrowStore();
