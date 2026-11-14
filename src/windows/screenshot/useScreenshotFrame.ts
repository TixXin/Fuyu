import { useEffect, useRef, useState } from "react";
import {
  getScreenshotFrame,
  getScreenshotSession,
  listenScreenshotEnded,
  listenScreenshotSession,
  screenshotOverlayReady,
  type ScreenshotSession,
} from "../../features/screenshot/api";
import type { Picture } from "../../features/screenshot/picture";
import { getErrorMessage } from "../../utils/error";

export function useScreenshotFrame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<ScreenshotSession | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenScreenshotSession((event) => setSession(event.payload)).then(keep);
    void listenScreenshotEnded(() => {
      setSession(null);
      setPicture(null);
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
    screenshotOverlayReady(id).catch((error: unknown) => console.error("Failed to show the screenshot", getErrorMessage(error)));
  }, [id]);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    getScreenshotFrame()
      .then((buffer) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = width;
        canvas.height = height;
        const data = new Uint8ClampedArray(buffer);
        canvas.getContext("2d")?.putImageData(new ImageData(data, width, height), 0, 0);
        setPicture({ id, width, height, data });
      })
      .catch((error: unknown) => console.error("Failed to show the screenshot", getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [id, width, height]);

  return { session, ready: id !== null, picture: id !== null && picture?.id === id ? picture : null, canvasRef };
}
