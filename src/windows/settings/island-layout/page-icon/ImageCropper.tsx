import { useEffect, useLayoutEffect, useRef } from "react";
import { clampZoom, paintCrop, type CropState } from "./imageImport";

const VIEW = 160;
const SCALE = 2;

type ImageCropperProps = { image: HTMLImageElement; crop: CropState; tip: string; onChange: (crop: CropState) => void };

export function ImageCropper({ image, crop, tip, onChange }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const cropRef = useRef(crop);
  useLayoutEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    paintCrop(context, VIEW * SCALE, image, crop);
    if (crop.shape === "none") return;
    context.strokeStyle = "rgba(116, 214, 255, 0.9)";
    context.lineWidth = 2;
    context.beginPath();
    if (crop.shape === "circle") context.arc(VIEW, VIEW, VIEW - 1, 0, Math.PI * 2);
    else context.roundRect(1, 1, VIEW * SCALE - 2, VIEW * SCALE - 2, VIEW * SCALE * 0.24);
    context.stroke();
  }, [image, crop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      onChange({ ...cropRef.current, zoom: clampZoom(cropRef.current.zoom * Math.exp(-event.deltaY * 0.002)) });
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [onChange]);

  return (
    <div className="page-icon-crop">
      <canvas
        ref={canvasRef}
        width={VIEW * SCALE}
        height={VIEW * SCALE}
        aria-hidden="true"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, dx: crop.dx, dy: crop.dy };
        }}
        onPointerMove={(event) => {
          const start = dragRef.current;
          if (!start) return;
          onChange({ ...cropRef.current, dx: start.dx + (event.clientX - start.x) / VIEW, dy: start.dy + (event.clientY - start.y) / VIEW });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      />
      <span className="page-icon-crop__tip">{tip}</span>
    </div>
  );
}
