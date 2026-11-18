import { AUDIO_ACTIVE_THRESHOLD } from "./mediaState.ts";

export interface AudioPeakStore {
  get(): number;
  set(next: number): void;
  sample(peak: number, active: boolean): boolean;
  mergeSnapshot(peak: number, active: boolean, paused: boolean): boolean;
  subscribe(listener: () => void): () => void;
}

export function createAudioPeakStore(): AudioPeakStore {
  let value = 0;
  const listeners = new Set<() => void>();

  const set = (next: number) => {
    const clamped = Number.isFinite(next) && next > 0 ? next : 0;
    if (Object.is(clamped, value)) return;
    value = clamped;
    for (const listener of listeners) listener();
  };

  return {
    get: () => value,
    set,
    sample(peak, active) {
      const decayed = value * 0.82;
      const nextPeak = active ? Math.max(decayed, peak) : decayed;
      const audioActive = active || nextPeak > AUDIO_ACTIVE_THRESHOLD * 1.5;
      set(audioActive ? nextPeak : 0);
      return audioActive;
    },
    mergeSnapshot(peak, active, paused) {
      if (paused) {
        set(0);
        return false;
      }
      const nextPeak = Math.max(value * 0.82, peak);
      const audioActive = active || nextPeak > AUDIO_ACTIVE_THRESHOLD;
      set(audioActive ? nextPeak : 0);
      return audioActive;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const audioPeakStore = createAudioPeakStore();
