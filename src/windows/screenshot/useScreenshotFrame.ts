import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  listenScreenshotEnded,
  listenScreenshotSession,
  screenshotOverlayReady,
  type ScreenshotSession,
} from "../../features/screenshot/api";
import {
  fetchScreenshotFrame,
  fetchScreenshotSession,
  peekReadyFrame,
  peekReadySession,
  resetPrefetchedScreenshot,
} from "../../features/screenshot/frame/api";
import type { Picture } from "../../features/screenshot/picture";
import { getErrorMessage } from "../../utils/error";

function initialPicture(): Picture | null {
  const initialSession = peekReadySession();
  if (!initialSession) return null;
  const data = peekReadyFrame(initialSession.id, initialSession.width, initialSession.height);
  return data ? { id: initialSession.id, width: initialSession.width, height: initialSession.height, data } : null;
}

export function useScreenshotFrame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readySentFor = useRef<number | null>(null);
  const drawnFor = useRef<string | null>(null);
  const [session, setSession] = useState<ScreenshotSession | null>(() => peekReadySession());
  const [picture, setPicture] = useState<Picture | null>(initialPicture);
  const hadInitialSession = useRef(session !== null);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenScreenshotSession((event) => {
      setSession((prev) => {
        if (prev && prev.id !== event.payload.id) {
          resetPrefetchedScreenshot();
          drawnFor.current = null;
        }
        return event.payload;
      });
    }).then(keep);
    void listenScreenshotEnded(() => {
      resetPrefetchedScreenshot();
      readySentFor.current = null;
      drawnFor.current = null;
      setSession(null);
      setPicture(null);
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width > 0 && canvas.height > 0) {
          canvas.getContext("2d", { alpha: false })?.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
      }
    }).then(keep);
    if (!hadInitialSession.current) {
      fetchScreenshotSession()
        .then((current) => { if (!cancelled && current) setSession(current); })
        .catch((error: unknown) => console.error("Failed to read the screenshot", getErrorMessage(error)));
    }
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  const id = session?.id ?? null;
  const width = session?.width ?? 0;
  const height = session?.height ?? 0;

  useLayoutEffect(() => {
    if (id === null || !picture || picture.id !== id || picture.width !== width || picture.height !== height) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const key = `${id}:${width}x${height}`;
    if (drawnFor.current !== key || canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d", { alpha: false })?.putImageData(new ImageData(picture.data, width, height), 0, 0);
      drawnFor.current = key;
    }
    if (readySentFor.current !== id) {
      readySentFor.current = id;
      screenshotOverlayReady(id).catch((error: unknown) => console.error("Failed to show the screenshot", getErrorMessage(error)));
    }
  }, [id, width, height, picture]);

  useEffect(() => {
    if (id === null) return;
    const key = `${id}:${width}x${height}`;
    if (drawnFor.current === key) {
      return;
    }
    let cancelled = false;
    const canvas = canvasRef.current;
    fetchScreenshotFrame(id, width, height)
      .then((data) => {
        if (cancelled || !canvas) return;
        if (data.byteLength !== width * height * 4) return;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d", { alpha: false })?.putImageData(new ImageData(data, width, height), 0, 0);
        drawnFor.current = key;
        setPicture({ id, width, height, data });
        if (readySentFor.current !== id) {
          readySentFor.current = id;
          screenshotOverlayReady(id).catch((error: unknown) => console.error("Failed to show the screenshot", getErrorMessage(error)));
        }
      })
      .catch((error: unknown) => console.error("Failed to show the screenshot", getErrorMessage(error)));
    return () => {
      cancelled = true;
      drawnFor.current = null;
      setPicture(null);
      if (canvas) {
        if (canvas.width > 0 && canvas.height > 0) {
          canvas.getContext("2d", { alpha: false })?.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [id, width, height]);

  return { session, ready: id !== null, picture: id !== null && picture?.id === id ? picture : null, canvasRef };
}
