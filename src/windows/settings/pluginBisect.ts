export type BisectStep =
  | { phase: "idle" }
  | { phase: "testing"; step: number; candidates: readonly string[]; testedOff: readonly string[] }
  | { phase: "found"; culprit: string; step: number }
  | { phase: "clear"; step: number };

export function startBisect(thirdPartyIds: readonly string[]): BisectStep {
  const ids = [...new Set(thirdPartyIds.filter((id) => typeof id === "string" && id.trim() !== ""))];
  if (ids.length === 0) return { phase: "idle" };
  const mid = Math.ceil(ids.length / 2);
  return {
    phase: "testing",
    step: 1,
    candidates: ids,
    testedOff: ids.slice(0, mid),
  };
}

export function answerBisect(state: BisectStep, outcome: "fixed" | "still-broken"): BisectStep {
  if (state.phase !== "testing") return state;
  const offSet = new Set(state.testedOff);
  const nextCandidates = outcome === "fixed"
    ? state.candidates.filter((id) => offSet.has(id))
    : state.candidates.filter((id) => !offSet.has(id));

  if (nextCandidates.length === 0) {
    return { phase: "clear", step: state.step };
  }
  if (nextCandidates.length === 1) {
    if (outcome === "fixed" && state.testedOff.length === 1) {
      return { phase: "found", culprit: nextCandidates[0], step: state.step };
    }
    if (outcome === "still-broken" && state.candidates.length === 2) {
      return { phase: "found", culprit: nextCandidates[0], step: state.step };
    }
  }
  const mid = Math.ceil(nextCandidates.length / 2);
  return {
    phase: "testing",
    step: state.step + 1,
    candidates: nextCandidates,
    testedOff: nextCandidates.slice(0, mid),
  };
}

export function bisectOffList(state: BisectStep): string[] {
  if (state.phase === "testing") return [...state.testedOff];
  if (state.phase === "found") return [state.culprit];
  return [];
}
