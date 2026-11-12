// Easing curves a cubic-bezier cannot draw, written out as CSS linear() (Chromium 113+, which
// WebView2 is): a spring that swings past its target and back a few times, and a landing that
// reaches its target and bounces back from it without ever passing it. Used by the bouncy
// open-and-close preset (C49, islandMotion.ts).

const SAMPLES = 72;

function toLinear(curve: (t: number) => number): string {
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const value = i === SAMPLES ? 1 : curve(i / SAMPLES);
    points.push(String(Math.round(value * 10000) / 10000));
  }
  return `linear(${points.join(", ")})`;
}

/**
 * A damped spring over the whole duration: `damping` is the damping ratio (below 1 it swings),
 * and the swings have died to a thousandth of the distance by the end.
 */
export function springCurve(damping: number): string {
  const settle = Math.log(1000);
  const swing = Math.sqrt(1 - damping * damping);
  // Time in units where the envelope e^(-damping * w * t) reaches 1/1000 at t = 1.
  const w = settle / damping;
  return toLinear((t) => {
    const decay = Math.exp(-damping * w * t);
    return 1 - decay * (Math.cos(swing * w * t) + (damping / swing) * Math.sin(swing * w * t));
  });
}

/**
 * Eases out to the target by `reach` (a fraction of the duration), then bounces back from it:
 * each bounce an arc `depth` of the distance deep and `length` of the duration long. Never past
 * the target, so nothing it sizes grows beyond where it ends.
 */
export function landingCurve(reach: number, bounces: readonly { depth: number; length: number }[]): string {
  return toLinear((t) => {
    // Slowing down, but still moving as it lands, so the bounce reads as a landing.
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
