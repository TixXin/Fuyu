import { useCallback, useState, type RefObject } from "react";
import { replacePin, reservePinSpace, type PinInfo } from "../../features/screenshot/api";
import { drawAnnotations } from "../../features/screenshot/drawAnnotations";
import type { Size } from "../../features/screenshot/selection";
import { useAnnotations } from "./useAnnotations";
import { useAnnotationSelect } from "./useAnnotationSelect";

export const PIN_BAR = { width: 430, height: 84 };

type Edit = { id: number; scale: number; css: Size };

function compose(picture: HTMLImageElement, info: PinInfo, items: Parameters<typeof drawAnnotations>[1]): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = info.width;
  canvas.height = info.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(picture, 0, 0, info.width, info.height);
  drawAnnotations(context, items, picture, null);
  const image = context.getImageData(0, 0, info.width, info.height);
  canvas.width = 0;
  canvas.height = 0;
  return image;
}

export function usePinEditing(info: PinInfo | null, frame: RefObject<HTMLDivElement | null>, picture: RefObject<HTMLImageElement | null>, report: (error: unknown) => void) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const annotations = useAnnotations(edit?.id, edit?.scale ?? 1);
  const select = useAnnotationSelect(annotations, edit?.scale ?? 1);

  const start = useCallback(() => {
    const rect = frame.current?.getBoundingClientRect();
    if (!info || !rect || rect.width === 0 || rect.height === 0) return;
    setEdit((current) => current ?? { id: Date.now(), scale: info.width / rect.width, css: { width: rect.width, height: rect.height } });
    reservePinSpace(PIN_BAR.width, PIN_BAR.height).catch(report);
  }, [info, frame, report]);

  const stop = useCallback(() => {
    setEdit(null);
    reservePinSpace(0, 0).catch(report);
  }, [report]);

  const { items } = annotations;
  const done = useCallback(() => {
    const image = picture.current;
    if (info && image && items.length > 0) {
      const composed = compose(image, info, items);
      if (composed) replacePin(composed).catch(report);
    }
    stop();
  }, [info, items, picture, report, stop]);

  return { editing: edit, annotations, select, start, cancel: stop, done };
}
