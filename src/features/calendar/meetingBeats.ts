export const MEETING_BEAT_MS = 8000;
export const MEETING_LAST_CALL_MS = 60_000;

export function meetingBeats(startMs: number, seenAt: number): number[] {
  const beats = [seenAt];
  for (const at of [startMs - MEETING_LAST_CALL_MS, startMs]) {
    if (at >= beats[beats.length - 1] + MEETING_BEAT_MS) beats.push(at);
  }
  return beats;
}

export function meetingBeatAt(beats: readonly number[], now: number): { showing: boolean; changeAt: number | null } {
  for (const at of beats) {
    if (now < at) return { showing: false, changeAt: at };
    if (now < at + MEETING_BEAT_MS) return { showing: true, changeAt: at + MEETING_BEAT_MS };
  }
  return { showing: false, changeAt: null };
}
