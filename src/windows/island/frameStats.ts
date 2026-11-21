export function summarizeFrames(startedAt: number, frames: number[]) {
  const gaps: number[] = [];
  let previous = startedAt;
  for (const at of frames) {
    gaps.push(at - previous);
    previous = at;
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const pick = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
  return {
    frames: frames.length,
    first: gaps[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    p50: pick(0.5),
    p90: pick(0.9),
    drops: gaps.filter((gap) => gap > pick(0.5) * 1.5).length,
    late: gaps.filter((gap) => gap > 34).length,
  };
}
