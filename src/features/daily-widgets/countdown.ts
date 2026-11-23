const TICK_MS = 1000;
const LATE_MS = 15;

export function countdownClock(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / TICK_MS);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function countdownTickDelay(endsAt: number, now: number) {
  const left = endsAt - now;
  if (left <= 0) return LATE_MS;
  const rest = left % TICK_MS;
  return (rest > 0 ? rest : TICK_MS) + LATE_MS;
}
