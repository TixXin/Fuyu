import { Channel, isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import { contrastBoost } from "../../lib/theme/wallpaperSlice";
import { setGlassCaptureOptions, startGlassCapture, stopGlassCapture } from "./api";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { frameLuminance, glassFramePlacement, parseGlassMessage, type GlassFrame, type ViewBox } from "./glassFrame";
import type { LiveBackdropState } from "./glassStatus";

const STARTING: LiveBackdropState = { state: "starting" };
const LIVE: LiveBackdropState = { state: "live" };
const MAX_TRACK_MS = 1200;

function viewBox(element: Element): ViewBox {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function sameState(a: LiveBackdropState, b: LiveBackdropState) {
  return a.state === b.state && (a.state !== "failed" || b.state !== "failed" || a.reason === b.reason);
}

export function useGlassCapture({
  target,
  enabled,
  blur,
  saturation,
  contrastGuard,
  lightIsland,
}: {
  target: RefObject<HTMLElement | null>;
  enabled: boolean;
  blur: number;
  saturation: number;
  contrastGuard: boolean;
  lightIsland: boolean;
}): LiveBackdropState {
  const [live, setLive] = useState<LiveBackdropState>(STARTING);
  const options = useRef({ blur, saturation, contrastGuard, lightIsland });
  const devicePixelRatio = useDevicePixelRatio();

  useEffect(() => {
    options.current = { blur, saturation, contrastGuard, lightIsland };
  }, [blur, saturation, contrastGuard, lightIsland]);

  useEffect(() => {
    const layer = target.current;
    const island = layer?.closest<HTMLElement>(".island");
    const holder = layer?.querySelector<HTMLElement>(".island__glass-live");
    const canvas = holder?.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (!enabled || !isTauri() || !island || !holder || !canvas || !context) return;
    let alive = true;
    let frame: GlassFrame | null = null;
    let tracking = 0;
    let trackStart = 0;
    const report = (next: LiveBackdropState) => setLive((current) => (sameState(current, next) ? current : next));

    const place = () => {
      if (!frame) return;
      const box = viewBox(island);
      const placement = glassFramePlacement(frame, window.devicePixelRatio, box);
      holder.style.setProperty("--glass-live-x", `${placement.left}px`);
      holder.style.setProperty("--glass-live-y", `${placement.top}px`);
      holder.style.setProperty("--glass-live-width", `${placement.width}px`);
      holder.style.setProperty("--glass-live-height", `${placement.height}px`);
    };

    const shade = (next: GlassFrame) => {
      const { contrastGuard: guard, lightIsland: light } = options.current;
      const luminance = guard ? frameLuminance(next, window.devicePixelRatio, viewBox(island)) : null;
      const boost = luminance === null ? 0 : Math.round(contrastBoost(luminance, light) * 20) / 20;
      island.style.setProperty("--glass-live-boost", String(boost));
    };

    const channel = new Channel<ArrayBuffer | number[]>();
    channel.onmessage = (data) => {
      if (!alive) return;
      const message = parseGlassMessage(data);
      if (message.kind === "failed") {
        delete island.dataset.glassLive;
        report({ state: "failed", reason: message.reason });
        return;
      }
      if (message.kind !== "frame") return;
      frame = message.frame;
      if (canvas.width !== frame.width) canvas.width = frame.width;
      if (canvas.height !== frame.height) canvas.height = frame.height;
      context.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
      place();
      shade(frame);
      island.dataset.glassLive = "";
      report(LIVE);
    };

    const track = (now: number) => {
      place();
      tracking = now - trackStart < MAX_TRACK_MS ? requestAnimationFrame(track) : 0;
    };
    const startTracking = (event: Event) => {
      if (event.target !== island) return;
      trackStart = performance.now();
      if (!tracking) tracking = requestAnimationFrame(track);
    };
    const stopTracking = (event: Event) => {
      if (event.target !== island) return;
      if (tracking) cancelAnimationFrame(tracking);
      tracking = 0;
      place();
    };
    const observer = new ResizeObserver(place);
    observer.observe(island);
    window.addEventListener("resize", place);
    island.addEventListener("transitionrun", startTracking);
    island.addEventListener("transitionend", stopTracking);
    island.addEventListener("transitioncancel", stopTracking);

    void startGlassCapture(channel, options.current.blur, options.current.saturation).then(
      (result) => {
        if (alive && !result.started) report({ state: "failed", reason: result.reason ?? "unsupported" });
      },
      () => alive && report({ state: "failed", reason: "failed" }),
    );

    return () => {
      alive = false;
      if (tracking) cancelAnimationFrame(tracking);
      observer.disconnect();
      window.removeEventListener("resize", place);
      island.removeEventListener("transitionrun", startTracking);
      island.removeEventListener("transitionend", stopTracking);
      island.removeEventListener("transitioncancel", stopTracking);
      delete island.dataset.glassLive;
      island.style.removeProperty("--glass-live-boost");
      setLive(STARTING);
      void stopGlassCapture().catch(() => {});
    };
  }, [enabled, target]);

  useEffect(() => {
    if (!enabled || !isTauri()) return;
    void setGlassCaptureOptions(blur, saturation).catch(() => {});
  }, [enabled, blur, saturation, devicePixelRatio]);

  return enabled ? live : STARTING;
}
