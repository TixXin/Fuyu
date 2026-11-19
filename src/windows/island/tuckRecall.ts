export type TuckSource = "idle" | "manual" | null;

export type TuckEvent = "idleTuck" | "tuckIsland" | "minimizeToEdge" | "endPeek" | "reveal" | "collapse" | "setMode";

export function nextTuckSource(source: TuckSource, event: TuckEvent): TuckSource {
  switch (event) {
    case "idleTuck":
      return "idle";
    case "tuckIsland":
    case "minimizeToEdge":
      return "manual";
    case "endPeek":
      return source;
    default:
      return null;
  }
}

export type TuckRecallState = {
  isTucked: boolean;
  tuckSource: TuckSource;
  hold: boolean;
  autoTuck: boolean;
};

export function shouldRecallIdleTuck({ isTucked, tuckSource, hold, autoTuck }: TuckRecallState): boolean {
  return isTucked && tuckSource === "idle" && hold && autoTuck;
}
