const SAMPLES = 72;

function toLinear(curve: (t: number) => number): string {
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const value = i === SAMPLES ? 1 : curve(i / SAMPLES);
    points.push(String(Math.round(value * 10000) / 10000));
  }
  return `linear(${points.join(", ")})`;
}

export function springCurve(damping: number): string {
  const settle = Math.log(1000);
  const swing = Math.sqrt(1 - damping * damping);
  const w = settle / damping;
  return toLinear((t) => {
    const decay = Math.exp(-damping * w * t);
    return 1 - decay * (Math.cos(swing * w * t) + (damping / swing) * Math.sin(swing * w * t));
  });
}

export function springResponse(damping: number, omega: number, ms: number): string {
  const seconds = ms / 1000;
  if (damping >= 1) return toLinear((t) => 1 - (1 + omega * t * seconds) * Math.exp(-omega * t * seconds));
  const swing = omega * Math.sqrt(1 - damping * damping);
  return toLinear((t) => {
    const at = t * seconds;
    return 1 - Math.exp(-damping * omega * at) * (Math.cos(swing * at) + ((damping * omega) / swing) * Math.sin(swing * at));
  });
}

export function landingCurve(reach: number, bounces: readonly { depth: number; length: number }[]): string {
  return toLinear((t) => {
    if (t < reach) return (t / reach) * (1.6 - 0.6 * (t / reach));
    let start = reach;
    for (const { depth, length } of bounces) {
      if (t < start + length) {
        const u = (t - start) / length;
        return 1 - depth * 4 * u * (1 - u);
      }
      start += length;
    }
    return 1;
  });
}
