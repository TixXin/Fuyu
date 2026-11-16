import { useEffect, useRef, useState } from "react";
import { readClipboardHistoryImage } from "../../features/clipboard/api";
import { cropRect, fitScale, rotatedSize, type ImagePoint, type ImageSize, type QuarterTurn } from "../../features/clipboard/imageEdit";
import type { Annotation } from "../../features/screenshot/annotations";
import { drawAnnotations } from "../../features/screenshot/drawAnnotations";
import { useAnnotations } from "../screenshot/useAnnotations";

type Step = { base: HTMLCanvasElement; items: readonly Annotation[] };
type CropDrag = { from: ImagePoint; to: ImagePoint };

function blank(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function paint(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = blank(width, height);
  const context = canvas.getContext("2d");
  if (context) draw(context);
  return canvas;
}

const flattened = (base: HTMLCanvasElement, items: readonly Annotation[]) =>
  items.length === 0 ? base : paint(base.width, base.height, (context) => {
    context.drawImage(base, 0, 0);
    drawAnnotations(context, items, base, null);
  });

function rotated(base: HTMLCanvasElement, turn: QuarterTurn) {
  const size = rotatedSize(base);
  return paint(size.width, size.height, (context) => {
    context.translate(size.width / 2, size.height / 2);
    context.rotate((turn * Math.PI) / 2);
    context.drawImage(base, -base.width / 2, -base.height / 2);
  });
}

async function load(id: string) {
  const bytes = await readClipboardHistoryImage(id);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const canvas = paint(bitmap.width, bitmap.height, (context) => context.drawImage(bitmap, 0, 0));
  bitmap.close();
  return canvas;
}

export function useImageEditor(id: string, box: ImageSize) {
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [steps, setSteps] = useState<readonly Step[]>([]);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState<CropDrag | null>(null);
  const dragging = useRef(false);
  const fit = base ? fitScale(base, box) : 1;
  const annotations = useAnnotations(undefined, 1 / fit);

  useEffect(() => {
    let cancelled = false;
    load(id).then((canvas) => !cancelled && setBase(canvas), (error: unknown) => {
      console.error("Failed to open the clipboard image for editing", error);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const transform = (make: (flat: HTMLCanvasElement) => HTMLCanvasElement) => {
    if (!base) return;
    const items = annotations.items;
    setSteps((current) => [...current, { base, items }]);
    annotations.reset();
    setBase(make(flattened(base, items)));
  };

  const cancelCrop = () => {
    dragging.current = false;
    setCrop(null);
    setCropping(false);
  };

  const area = crop && base ? cropRect(crop.from, crop.to, base) : null;
  const applyCrop = () => {
    cancelCrop();
    if (area) transform((flat) => paint(area.width, area.height, (context) => context.drawImage(flat, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)));
  };

  const undo = () => {
    if (crop) return cancelCrop();
    if (annotations.canUndo) return annotations.undo();
    const last = steps[steps.length - 1];
    if (!last) return;
    setSteps(steps.slice(0, -1));
    setBase(last.base);
    annotations.reset();
    annotations.addMany(last.items);
  };

  const compose = () => {
    if (!base) return null;
    return flattened(base, annotations.items).getContext("2d")?.getImageData(0, 0, base.width, base.height) ?? null;
  };

  return {
    base,
    failed,
    fit,
    annotations,
    cropping,
    crop: area,
    changed: steps.length > 0 || annotations.items.length > 0,
    canUndo: crop !== null || annotations.canUndo || steps.length > 0,
    startCrop: () => {
      annotations.clearTool();
      if (cropping) cancelCrop();
      else setCropping(true);
    },
    chooseTool: (tool: Parameters<typeof annotations.chooseTool>[0]) => {
      cancelCrop();
      annotations.chooseTool(tool);
    },
    cancelCrop,
    applyCrop,
    rotate: (turn: QuarterTurn) => {
      cancelCrop();
      transform((flat) => rotated(flat, turn));
    },
    undo,
    redo: annotations.redo,
    compose,
    pointerDown: (point: ImagePoint) => {
      if (cropping) {
        dragging.current = true;
        setCrop({ from: point, to: point });
        return true;
      }
      if (!annotations.tool || annotations.editing) return false;
      annotations.begin(point);
      return true;
    },
    pointerMove: (point: ImagePoint) => {
      if (dragging.current) setCrop((current) => current && { ...current, to: point });
      else annotations.extend(point);
    },
    pointerUp: () => {
      dragging.current = false;
      annotations.finish();
    },
  };
}

export type ImageEditor = ReturnType<typeof useImageEditor>;
