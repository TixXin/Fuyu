export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (progress: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let t = progress;
    for (let step = 0; step < 8; step += 1) {
      const error = sampleX(t) - progress;
      const slope = slopeX(t);
      if (Math.abs(error) < 1e-5 || Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}

export const easeOut = cubicBezier(0.22, 1, 0.36, 1);

export function animateScroll(element: HTMLElement, left: number, ms: number, done: () => void): () => void {
  const from = element.scrollLeft;
  if (ms <= 0 || Math.abs(left - from) < 1) {
    element.scrollLeft = left;
    done();
    return () => undefined;
  }
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / ms);
    element.scrollLeft = from + (left - from) * easeOut(progress);
    if (progress < 1) frame = window.requestAnimationFrame(step);
    else done();
  };
  frame = window.requestAnimationFrame(step);
  return () => window.cancelAnimationFrame(frame);
}
