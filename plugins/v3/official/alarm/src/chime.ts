import type { AlarmTone } from "./model.ts";

let sharedCtx: AudioContext | null = null;

const FULL_GAIN = 0.23;
const FADE_FLOOR = 0.15;
const FADE_MAX_MS = 20_000;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function ringLevel(volume: number, fadeIn: boolean, elapsedMs: number, ringMs: number): number {
  const base = Math.min(100, Math.max(0, volume)) / 100;
  if (!fadeIn) return base;
  const span = Math.max(1, Math.min(FADE_MAX_MS, ringMs * 0.6));
  const progress = Math.min(1, Math.max(0, elapsedMs) / span);
  return base * (FADE_FLOOR + (1 - FADE_FLOOR) * progress);
}

export function playAlarmTone(tone: AlarmTone, level = 0.7): void {
  if (tone === "mute" || level <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const peak = Math.max(0.0002, FULL_GAIN * Math.min(1, level));

  const t0 = ctx.currentTime + 0.02;
  const notes: Array<{ freq: number; offset: number; duration: number; wave: OscillatorType }> =
    tone === "bell"
      ? [
          { freq: 880, offset: 0, duration: 0.35, wave: "sine" },
          { freq: 1174.66, offset: 0.28, duration: 0.45, wave: "sine" },
          { freq: 1318.51, offset: 0.62, duration: 0.55, wave: "sine" },
        ]
      : tone === "digital"
        ? [
            { freq: 1046.5, offset: 0, duration: 0.12, wave: "triangle" },
            { freq: 1046.5, offset: 0.16, duration: 0.12, wave: "triangle" },
            { freq: 1318.51, offset: 0.36, duration: 0.18, wave: "triangle" },
          ]
        : [
            { freq: 523.25, offset: 0, duration: 0.22, wave: "sine" },
            { freq: 659.25, offset: 0.2, duration: 0.22, wave: "sine" },
            { freq: 783.99, offset: 0.4, duration: 0.28, wave: "sine" },
            { freq: 1046.5, offset: 0.64, duration: 0.42, wave: "sine" },
          ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.freq, t0 + note.offset);
    gain.gain.setValueAtTime(0.0001, t0 + note.offset);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + note.offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.offset + note.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0 + note.offset);
    osc.stop(t0 + note.offset + note.duration + 0.02);
  }
}
