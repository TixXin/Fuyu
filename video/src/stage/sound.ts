export type SoundName = "click" | "whoosh" | "start" | "approval" | "ack" | "complete" | `voice:${string}`;

export type SoundCue = { at: number; name: SoundName };

const cues: SoundCue[] = [];
let startedAt: number | null = null;

export function startSoundClock() {
  startedAt = performance.now();
}

export function sound(name: SoundName) {
  if (startedAt === null) return;
  cues.push({ at: Math.round(performance.now() - startedAt), name });
}

export function soundCues(): readonly SoundCue[] {
  return cues;
}
