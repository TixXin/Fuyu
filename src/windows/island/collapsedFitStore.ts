export const FIT_STEP = 8;
export const FIT_SHRINK = 32;
export const FIT_GAP = 8;

export function holdFitWidth(held: number | undefined, measured: number, floor = 0) {
  const next = Math.max(Math.ceil(Math.max(0, measured) / FIT_STEP) * FIT_STEP, Math.ceil(Math.max(0, floor)));
  if (held === undefined || next > held || next <= held - FIT_SHRINK) return next;
  return held;
}

export function fitTotal(widths: Iterable<number>) {
  let total = 0;
  for (const width of widths) total += width + FIT_GAP;
  return total;
}

export function createCollapsedFit() {
  const held = new Map<string, number>();
  const holds = new Set<string>();
  const listeners = new Set<() => void>();
  let total = 0;
  let heldFlag = false;
  const publish = () => {
    const next = fitTotal(held.values());
    const nextHeld = holds.size > 0;
    if (next === total && nextHeld === heldFlag) return;
    total = next;
    heldFlag = nextHeld;
    for (const listener of listeners) listener();
  };
  return {
    report(id: string, measured: number, floor = 0) {
      const before = held.get(id);
      const next = holdFitWidth(before, measured, floor);
      if (next === before) return;
      held.set(id, next);
      publish();
    },
    hold(id: string, width: number) {
      const added = !holds.has(id);
      holds.add(id);
      const before = held.get(id);
      const next = holdFitWidth(before, width, 0);
      if (next !== before) held.set(id, next);
      if (added || next !== before) publish();
    },
    drop(id: string) {
      const droppedWidth = held.delete(id);
      const droppedHold = holds.delete(id);
      if (droppedWidth || droppedHold) publish();
    },
    total: () => total,
    isHeld: () => heldFlag,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type CollapsedFitStore = ReturnType<typeof createCollapsedFit>;

export const collapsedFit = createCollapsedFit();

export function fitFloor(width: unknown, context: unknown) {
  try {
    const value: unknown = typeof width === "function" ? (width as (context: unknown) => unknown)(context) : width;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
