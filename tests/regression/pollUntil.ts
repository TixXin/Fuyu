import { act } from "react";

const STEP_MS = 50;
const TIMEOUT_MS = 2000;

const step = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, STEP_MS)); });

export async function until<T>(ready: () => T, timeoutMs = TIMEOUT_MS): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  let value = ready();
  while (!value && performance.now() < deadline) {
    await step();
    value = ready();
  }
  return value;
}

export function animationsDone(target: Element | Document = document) {
  const running = target instanceof Document ? target.getAnimations() : target.getAnimations({ subtree: true });
  return running.every((animation) => animation.playState !== "running" || animation.effect?.getComputedTiming().endTime === Infinity);
}
