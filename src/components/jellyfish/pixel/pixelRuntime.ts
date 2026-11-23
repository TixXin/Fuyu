import { cancelWake, pixelTick, wakeAt } from "./pixelClock.ts";
import { composePixelJellyfish } from "./pixelCompose.ts";
import { fitPixelGrid } from "./pixelFit.ts";
import { PIXEL_GRIDS } from "./pixelGrids.ts";
import { poseAt, stillPose, ticksUntilChange, type PixelMood } from "./pixelPoses.ts";
import { PIXEL_STYLES, type PixelJellyfishStyle } from "./pixelStyles.ts";
import { mixRgb, parseRgb, pixelTones, type Rgb } from "./pixelTones.ts";

export type PixelRenderOptions = { style: PixelJellyfishStyle; mood: PixelMood; paused: boolean; still: boolean };

const FALLBACK_FILL: Rgb = [246, 227, 211];
const BLEND_STEPS = 3;
const resolved = new Map<string, Rgb | null>();
let probe: CanvasRenderingContext2D | null | undefined;

function fillOf(color: string): Rgb | null {
  const plain = parseRgb(color);
  if (plain) return plain;
  const known = resolved.get(color);
  if (known !== undefined) return known;
  if (probe === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  }
  let found: Rgb | null = null;
  if (probe && color && CSS.supports("color", color)) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = probe.getImageData(0, 0, 1, 1).data;
    if (alpha > 0) found = [red, green, blue];
  }
  resolved.set(color, found);
  return found;
}

export function createPixelRenderer(wrap: HTMLElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  let options: PixelRenderOptions | null = null;
  let started = pixelTick();
  let frozenAt: number | null = null;
  let shown: Rgb | null = null;
  let blend: { from: Rgb; at: number } | null = null;
  let drawn = "";
  let frame = 0;

  const render = () => {
    if (!options || !context) return;
    const boxHeight = wrap.clientHeight;
    if (!boxHeight) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const spec = PIXEL_STYLES[options.style];
    const fit = fitPixelGrid(boxHeight, pixelRatio, spec.grids.map((key) => PIXEL_GRIDS[key].height));
    const grid = PIXEL_GRIDS[spec.grids[fit.index]];
    const now = pixelTick();
    const moving = !options.still && !options.paused;
    const tick = (frozenAt ?? now) - started;
    const pose = options.still ? stillPose(options.mood) : poseAt(options.mood, tick);
    const target = fillOf(window.getComputedStyle(wrap).color) ?? FALLBACK_FILL;
    const blendStep = blend && moving ? now - blend.at + 1 : BLEND_STEPS;
    const blending = blend !== null && blendStep < BLEND_STEPS;
    const fill = blend && blending ? mixRgb(blend.from, target, blendStep / BLEND_STEPS) : target;
    if (!blending) blend = null;
    const light = wrap.closest(".island-light") !== null;
    const pale = light && (options.mood === "idle" || options.mood === "sleep");
    const key = JSON.stringify([options.style, grid.key, fit.cell, pixelRatio, boxHeight, pose, fill, light, pale]);
    if (key !== drawn) {
      drawn = key;
      shown = fill;
      const buffer = composePixelJellyfish(grid, spec.paint, pose, pixelTones(spec.paint, fill, light, pale));
      if (canvas.width !== buffer.width) canvas.width = buffer.width;
      if (canvas.height !== buffer.height) canvas.height = buffer.height;
      const image = context.createImageData(buffer.width, buffer.height);
      image.data.set(buffer.data);
      context.putImageData(image, 0, 0);
      const cell = fit.cell / pixelRatio;
      const snap = (value: number) => Math.round(value * pixelRatio) / pixelRatio;
      canvas.style.width = `${buffer.width * cell}px`;
      canvas.style.height = `${buffer.height * cell}px`;
      canvas.style.left = `${snap((wrap.clientWidth - grid.width * cell) / 2) - buffer.originX * cell}px`;
      canvas.style.top = `${snap((boxHeight - grid.height * cell) / 2) - buffer.originY * cell}px`;
    }
    if (!moving) {
      cancelWake(render);
      return;
    }
    const ahead = blending ? 1 : ticksUntilChange(options.mood, tick);
    if (Number.isFinite(ahead)) wakeAt(render, now + ahead);
    else cancelWake(render);
  };

  const renderSoon = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  };

  const resize = new ResizeObserver(renderSoon);
  resize.observe(wrap);
  const classes = new MutationObserver(renderSoon);
  for (let node = wrap.parentElement; node; node = node.parentElement) classes.observe(node, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", renderSoon);
  let ratio: MediaQueryList | null = null;
  const watchRatio = () => {
    ratio?.removeEventListener("change", ratioChanged);
    ratio = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    ratio.addEventListener("change", ratioChanged);
  };
  function ratioChanged() {
    watchRatio();
    renderSoon();
  }
  watchRatio();

  return {
    update(next: PixelRenderOptions) {
      const now = pixelTick();
      if (options && options.mood !== next.mood) {
        started = now;
        frozenAt = next.paused ? now : null;
        blend = shown ? { from: shown, at: now } : null;
      } else if (next.paused && frozenAt === null) {
        frozenAt = now;
      } else if (!next.paused && frozenAt !== null) {
        started += now - frozenAt;
        frozenAt = null;
      }
      options = next;
      render();
    },
    dispose() {
      cancelWake(render);
      if (frame) window.cancelAnimationFrame(frame);
      resize.disconnect();
      classes.disconnect();
      window.removeEventListener("resize", renderSoon);
      ratio?.removeEventListener("change", ratioChanged);
    },
  };
}
