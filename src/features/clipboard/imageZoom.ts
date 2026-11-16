export type ZoomSize = { width: number; height: number };
export type ZoomPoint = { x: number; y: number };
export type ZoomView = { scale: number; x: number; y: number };
export type ZoomFrame = { viewport: ZoomSize; image: ZoomSize; unit: number };

export const ZOOM_STEP = 1.25;
export const MAX_ZOOM = 8;
const WHEEL_SPEED = 0.002;
const PINCH_SPEED = 0.01;
const LINE_PIXELS = 16;
const EPSILON = 0.001;

const valid = (size: ZoomSize) => size.width > 0 && size.height > 0;

export function fitScale({ viewport, image }: ZoomFrame): number {
  if (!valid(viewport) || !valid(image)) return 1;
  return Math.min(viewport.width / image.width, viewport.height / image.height);
}

export function scaleLimits(frame: ZoomFrame): { min: number; max: number } {
  const fit = fitScale(frame);
  return { min: Math.min(fit, frame.unit), max: Math.max(fit, frame.unit * MAX_ZOOM) };
}

function placeAxis(offset: number, shown: number, room: number): number {
  if (shown <= room) return (room - shown) / 2;
  return Math.min(0, Math.max(room - shown, offset));
}

export function clampView(view: ZoomView, frame: ZoomFrame): ZoomView {
  const { min, max } = scaleLimits(frame);
  const scale = Math.min(max, Math.max(min, view.scale));
  return {
    scale,
    x: placeAxis(view.x, frame.image.width * scale, frame.viewport.width),
    y: placeAxis(view.y, frame.image.height * scale, frame.viewport.height),
  };
}

export function fitView(frame: ZoomFrame): ZoomView {
  return clampView({ scale: fitScale(frame), x: 0, y: 0 }, frame);
}

export function isFit(view: ZoomView, frame: ZoomFrame): boolean {
  return Math.abs(view.scale - fitScale(frame)) < EPSILON;
}

export function viewportCenter(frame: ZoomFrame): ZoomPoint {
  return { x: frame.viewport.width / 2, y: frame.viewport.height / 2 };
}

export function zoomTo(view: ZoomView, scale: number, point: ZoomPoint, frame: ZoomFrame): ZoomView {
  const { min, max } = scaleLimits(frame);
  const next = Math.min(max, Math.max(min, scale));
  const ratio = next / view.scale;
  return clampView({ scale: next, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }, frame);
}

export function zoomBy(view: ZoomView, factor: number, point: ZoomPoint, frame: ZoomFrame): ZoomView {
  return zoomTo(view, view.scale * factor, point, frame);
}

export function stepZoom(view: ZoomView, direction: "in" | "out", frame: ZoomFrame): ZoomView {
  return zoomBy(view, direction === "in" ? ZOOM_STEP : 1 / ZOOM_STEP, viewportCenter(frame), frame);
}

export function toggleActual(view: ZoomView, point: ZoomPoint, frame: ZoomFrame): ZoomView {
  if (!isFit(view, frame)) return fitView(frame);
  if (Math.abs(frame.unit - view.scale) < EPSILON) return view;
  return zoomTo(view, frame.unit, point, frame);
}

export function panBy(view: ZoomView, dx: number, dy: number, frame: ZoomFrame): ZoomView {
  return clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy }, frame);
}

export function canPan(view: ZoomView, frame: ZoomFrame): boolean {
  return frame.image.width * view.scale > frame.viewport.width + EPSILON || frame.image.height * view.scale > frame.viewport.height + EPSILON;
}

export function wheelFactor(deltaY: number, deltaMode: number, pinch: boolean): number {
  const pixels = deltaMode === 1 ? deltaY * LINE_PIXELS : deltaMode === 2 ? deltaY * LINE_PIXELS * 20 : deltaY;
  const exponent = Math.max(-1, Math.min(1, -pixels * (pinch ? PINCH_SPEED : WHEEL_SPEED)));
  return Math.exp(exponent);
}

export function zoomPercent(view: ZoomView, frame: ZoomFrame): number {
  return Math.round((view.scale / frame.unit) * 100);
}
