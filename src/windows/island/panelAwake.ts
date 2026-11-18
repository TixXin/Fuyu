export const PREWARM_HOLD_MS = 1200;
export const PREWARM_LEAVE_MS = 260;

export type PanelAwakeInput = {
  isExpanded: boolean;
  isPreparing: boolean;
  isPrewarmed: boolean;
  deferColdOpen: boolean;
  closeHoldMs: number;
};

export type PanelAwakeState = {
  wasExpanded: boolean;
  closing: boolean;
  deferringOpen: boolean;
  warmBeforeExpand: boolean;
};

function keepIfEqual(prev: PanelAwakeState, next: PanelAwakeState): PanelAwakeState {
  if (
    prev.wasExpanded === next.wasExpanded &&
    prev.closing === next.closing &&
    prev.deferringOpen === next.deferringOpen &&
    prev.warmBeforeExpand === next.warmBeforeExpand
  ) {
    return prev;
  }
  return next;
}

export function initialPanelAwakeState(input: PanelAwakeInput): PanelAwakeState {
  return {
    wasExpanded: input.isExpanded,
    closing: false,
    deferringOpen: false,
    warmBeforeExpand: input.isExpanded || input.isPreparing || input.isPrewarmed,
  };
}

export function syncPanelAwakeState(prev: PanelAwakeState, input: PanelAwakeInput): PanelAwakeState {
  if (!input.isExpanded) {
    const closing = prev.wasExpanded
      ? !prev.deferringOpen && input.closeHoldMs > 0
      : prev.closing && input.closeHoldMs > 0;
    return keepIfEqual(prev, {
      wasExpanded: false,
      closing,
      deferringOpen: false,
      warmBeforeExpand: input.isPreparing || input.isPrewarmed || closing,
    });
  }

  if (!prev.wasExpanded) {
    const alreadyWarm =
      prev.warmBeforeExpand ||
      input.isPreparing ||
      input.isPrewarmed ||
      (prev.closing && input.closeHoldMs > 0);
    return keepIfEqual(prev, {
      wasExpanded: true,
      closing: false,
      deferringOpen: !alreadyWarm && input.deferColdOpen,
      warmBeforeExpand: true,
    });
  }

  return keepIfEqual(prev, {
    wasExpanded: true,
    closing: false,
    deferringOpen: prev.deferringOpen && input.deferColdOpen,
    warmBeforeExpand: true,
  });
}

export function finishDeferredOpen(prev: PanelAwakeState): PanelAwakeState {
  if (!prev.deferringOpen) return prev;
  return { ...prev, deferringOpen: false };
}

export function finishCloseHold(
  prev: PanelAwakeState,
  input: Pick<PanelAwakeInput, "isPreparing" | "isPrewarmed">,
): PanelAwakeState {
  if (!prev.closing || prev.wasExpanded) return prev;
  return keepIfEqual(prev, {
    wasExpanded: false,
    closing: false,
    deferringOpen: false,
    warmBeforeExpand: input.isPreparing || input.isPrewarmed,
  });
}

export function isPanelAwake(state: PanelAwakeState, input: PanelAwakeInput): boolean {
  if (input.isExpanded) {
    return !state.deferringOpen;
  }
  return input.isPreparing || input.isPrewarmed || (state.closing && input.closeHoldMs > 0);
}
