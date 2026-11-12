import { useEffect, useRef, useState } from "react";
import {
  getScreenshotFrame,
  getScreenshotSession,
  listenScreenshotEnded,
  listenScreenshotSession,
  screenshotOverlayReady,
  type ScreenshotSession,
} from "../../features/screenshot/api";
import { getErrorMessage } from "../../utils/error";

export function pictureContext(canvas: HTMLCanvasElement | null) {
  return canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
}

export function useScreenshotFrame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<ScreenshotSession | null>(null);
  const [drawn, setDrawn] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenScreenshotSession((event) => setSession(event.payload)).then(keep);
    void listenScreenshotEnded(() => {
      setSession(null);
      setDrawn(null);
      if (canvasRef.current) canvasRef.current.width = 0;
    }).then(keep);
    getScreenshotSession()
      .then((current) => { if (!cancelled && current) setSession(current); })
      .catch((error: unknown) => console.error("Failed to read the screenshot", getErrorMessage(error)));
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  const id = session?.id ?? null;
  const width = session?.width ?? 0;
  const height = session?.height ?? 0;
  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    getScreenshotFrame()
      .then((buffer) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = width;
        canvas.height = height;
        pictureContext(canvas)?.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
        setDrawn(id);
        return screenshotOverlayReady(id);
      })
      .catch((error: unknown) => console.error("Failed to show the screenshot", getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [id, width, height]);

  return { session, ready: id !== null && drawn === id, canvasRef };
}
