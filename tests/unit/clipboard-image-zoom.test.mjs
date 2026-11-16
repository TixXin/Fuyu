import assert from "node:assert/strict";
import test from "node:test";
import {
  canPan, clampView, fitScale, fitView, isFit, panBy, scaleLimits, stepZoom, toggleActual, wheelFactor, zoomBy, zoomPercent,
} from "../../src/features/clipboard/imageZoom.ts";

const frame = { viewport: { width: 400, height: 300 }, image: { width: 1600, height: 900 }, unit: 1 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≈ ${expected}`);

test("fit shrinks the image into the viewport and centres it", () => {
  close(fitScale(frame), 0.25);
  const view = fitView(frame);
  close(view.scale, 0.25);
  close(view.x, 0);
  close(view.y, (300 - 225) / 2);
  assert.ok(isFit(view, frame));
  assert.equal(canPan(view, frame), false);
});

test("a small image fits by growing and can still go down to 100%", () => {
  const small = { viewport: { width: 400, height: 300 }, image: { width: 100, height: 50 }, unit: 1 };
  close(fitScale(small), 4);
  assert.deepEqual(scaleLimits(small), { min: 1, max: 8 });
});

test("zooming keeps the point under the pointer still", () => {
  const view = fitView(frame);
  const point = { x: 100, y: 150 };
  const next = zoomBy(view, 2, point, frame);
  close(next.scale, 0.5);
  const before = { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
  const after = { x: (point.x - next.x) / next.scale, y: (point.y - next.y) / next.scale };
  close(after.x, before.x);
  close(after.y, before.y);
});

test("zoom stops at the fit size and at eight times actual pixels", () => {
  const view = fitView(frame);
  close(zoomBy(view, 0.1, { x: 0, y: 0 }, frame).scale, 0.25);
  close(zoomBy(view, 1000, { x: 0, y: 0 }, frame).scale, 8);
});

test("panning never leaves a gap at the edges of a zoomed image", () => {
  const zoomed = zoomBy(fitView(frame), 4, { x: 200, y: 150 }, frame);
  assert.ok(canPan(zoomed, frame));
  const far = panBy(zoomed, 10_000, 10_000, frame);
  close(far.x, 0);
  close(far.y, 0);
  const other = panBy(zoomed, -10_000, -10_000, frame);
  close(other.x, 400 - 1600);
  close(other.y, 300 - 900);
});

test("an axis that fits stays centred while the other pans", () => {
  const wide = { viewport: { width: 400, height: 300 }, image: { width: 1600, height: 200 }, unit: 1 };
  const view = clampView({ scale: 1, x: -50, y: 40 }, wide);
  close(view.x, -50);
  close(view.y, 50);
});

test("double-click goes to actual pixels at the pointer and back to fit", () => {
  const fit = fitView(frame);
  const actual = toggleActual(fit, { x: 0, y: fit.y }, frame);
  close(actual.scale, 1);
  close(actual.x, 0);
  close(actual.y, 0);
  assert.ok(isFit(toggleActual(actual, { x: 10, y: 10 }, frame), frame));
});

test("on a 2x screen 100% means one image pixel per screen pixel", () => {
  const retina = { ...frame, unit: 0.5 };
  const actual = toggleActual(fitView(retina), { x: 200, y: 150 }, retina);
  close(actual.scale, 0.5);
  assert.equal(zoomPercent(actual, retina), 100);
  assert.equal(zoomPercent(fitView(retina), retina), 50);
});

test("+ and - step around the centre", () => {
  const view = fitView(frame);
  const bigger = stepZoom(view, "in", frame);
  close(bigger.scale, 0.3125);
  close(stepZoom(bigger, "out", frame).scale, 0.25);
});

test("wheel up zooms in, wheel down zooms out, pinches move faster", () => {
  assert.ok(wheelFactor(-100, 0, false) > 1);
  assert.ok(wheelFactor(100, 0, false) < 1);
  assert.ok(wheelFactor(-10, 0, true) > wheelFactor(-10, 0, false));
  close(wheelFactor(-3, 1, false), wheelFactor(-48, 0, false));
  close(wheelFactor(-100_000, 0, false), Math.E);
});

test("an empty viewport does not divide by zero", () => {
  const empty = { viewport: { width: 0, height: 0 }, image: { width: 100, height: 100 }, unit: 1 };
  const view = fitView(empty);
  assert.ok(Number.isFinite(view.scale) && Number.isFinite(view.x) && Number.isFinite(view.y));
});
