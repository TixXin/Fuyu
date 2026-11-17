import { useSyncExternalStore } from "react";
import complete from "../../assets/sounds/thumb-piano/complete.wav";
import { windowServices } from "../plugin-kernel/services.ts";
import { hasLegacyTimers, isTimersMigrated, loadLegacyTimers, markTimersMigrated, TIMERS_KEY, TIMERS_MIGRATED_KEY } from "./storage.ts";
import { createTimerController, type StartTimerResult, type TimerSnapshot } from "./timerController.ts";

export { TIMERS_KEY, TIMERS_MIGRATED_KEY };
export type { StartTimerResult, TimerSnapshot };

function playRingSound() {
  void new Audio(complete).play().catch((error: unknown) => console.error("Failed to play the timer sound", error));
}

const controller = createTimerController({
  services: windowServices,
  migration: {
    hasLegacy: hasLegacyTimers,
    loadLegacy: loadLegacyTimers,
    isMigrated: isTimersMigrated,
    markMigrated: () => {
      markTimersMigrated();
    },
  },
  onRing: playRingSound,
});

export const configureTimers = controller.configure;
export const startCountdown = controller.startCountdown;
export const startStopwatch = controller.startStopwatch;
export const pauseTimer = controller.pauseTimer;
export const resumeTimer = controller.resumeTimer;
export const cancelTimer = controller.cancelTimer;
export const extendTimer = controller.extendTimer;
export const dismissRinging = controller.dismissRinging;
export const extendRinging = controller.extendRinging;
export const requestTimerPage = controller.requestTimerPage;

export function useTimers(): TimerSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}
