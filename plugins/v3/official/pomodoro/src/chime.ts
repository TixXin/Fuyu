let shared: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!shared || shared.state === "closed") shared = new Ctor();
  if (shared.state === "suspended") void shared.resume().catch(() => {});
  return shared;
}

export function playChime(): void {
  const ctx = audio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  const notes = [
    { freq: 659.25, offset: 0, duration: 0.3 },
    { freq: 880, offset: 0.24, duration: 0.5 },
  ];
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.freq, t0 + note.offset);
    gain.gain.setValueAtTime(0.0001, t0 + note.offset);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + note.offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.offset + note.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0 + note.offset);
    osc.stop(t0 + note.offset + note.duration + 0.02);
  }
}
