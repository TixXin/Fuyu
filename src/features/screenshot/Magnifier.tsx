import { useEffect, useRef } from "react";
import { magnifierPosition, type Point, type Size } from "./selection";
import "./Magnifier.css";

/** Pixels across the zoomed square; odd, so one sits in the middle. */
const SPAN = 15;
/** The zoomed square's side, in CSS pixels. */
const ZOOM_SIZE = 120;
/** The whole box (square and text) for keeping it inside the view. */
const BOX: Size = { width: 132, height: 196 };
const GAP = 20;

/**
 * The magnifier beside the pointer on a screenshot overlay: the pixels around `pixel` (picture
 * pixels) blown up without smoothing, the middle one outlined, and `lines` of text below.
 */
export function Magnifier({
  picture,
  pixel,
  pointer,
  view,
  color,
  lines,
}: {
  picture: HTMLCanvasElement | null;
  pixel: Point;
  /** The pointer in CSS pixels, to place the box. */
  pointer: Point;
  view: Size;
  /** The colour under the pointer, `#RRGGBB`. */
  color: string;
  lines: string[];
}) {
  const zoom = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = zoom.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !picture) return;
    const side = Math.round(ZOOM_SIZE * window.devicePixelRatio);
    if (canvas.width !== side) {
      canvas.width = side;
      canvas.height = side;
    }
    const half = (SPAN - 1) / 2;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#000";
    context.fillRect(0, 0, side, side);
    context.drawImage(picture, pixel.x - half, pixel.y - half, SPAN, SPAN, 0, 0, side, side);
    const cell = side / SPAN;
    context.lineWidth = Math.max(1, window.devicePixelRatio);
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.strokeRect(half * cell, half * cell, cell, cell);
    context.strokeStyle = "rgba(0, 0, 0, 0.6)";
    context.strokeRect(half * cell - context.lineWidth, half * cell - context.lineWidth, cell + context.lineWidth * 2, cell + context.lineWidth * 2);
  }, [picture, pixel.x, pixel.y]);

  const place = magnifierPosition(pointer, BOX, view, GAP);
  return (
    <div className="screenshot-magnifier" style={{ left: place.x, top: place.y }} aria-hidden="true">
      <canvas ref={zoom} className="screenshot-magnifier__zoom" style={{ width: ZOOM_SIZE, height: ZOOM_SIZE }} />
      <div className="screenshot-magnifier__color">
        <span className="screenshot-magnifier__swatch" style={{ background: color }} />
        {color}
      </div>
      {lines.map((line) => (
        <div key={line} className="screenshot-magnifier__line">{line}</div>
      ))}
    </div>
  );
}
