import { Channel, isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import { contrastFrost, settleFrost } from "../../lib/theme/wallpaperSlice";
import { setGlassCaptureOptions, startGlassCapture, stopGlassCapture, type GlassCaptureStart } from "./api";
import { createGlassCaptureHub, type GlassCaptureData } from "./glassCaptureHub";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { frameLuminance, glassFramePlacement, parseGlassMessage, type GlassFrame, type ViewBox } from "./glassFrame";
import type { LiveBackdropState } from "./glassStatus";

const STARTING: LiveBackdropState = { state: "starting" };
const LIVE: LiveBackdropState = { state: "live" };
const MAX_TRACK_MS = 1200;

const sharedCapture = createGlassCaptureHub<GlassCaptureStart>(() => void stopGlassCapture().catch(() => {}));

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
  islandBackground,
}: {
  target: RefObject<HTMLElement | null>;
  enabled: boolean;
  blur: number;
  saturation: number;
  contrastGuard: boolean;
  islandBackground: string;
}): LiveBackdropState {
  const [live, setLive] = useState<LiveBackdropState>(STARTING);
  const options = useRef({ blur, saturation, contrastGuard, islandBackground });
  const reshadeLatest = useRef(() => {});
  const devicePixelRatio = useDevicePixelRatio();

  useEffect(() => {
    options.current = { blur, saturation, contrastGuard, islandBackground };
    reshadeLatest.current();
  }, [blur, saturation, contrastGuard, islandBackground]);

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
    let frost = 0;
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
      const { contrastGuard: guard, islandBackground: background } = options.current;
      const luminance = guard ? frameLuminance(next, window.devicePixelRatio, viewBox(island)) : null;
      if (!guard) frost = 0;
      else if (luminance) frost = settleFrost(frost, contrastFrost(luminance, background));
      island.style.setProperty("--glass-live-frost", String(frost));
    };

    const onMessage = (data: GlassCaptureData) => {
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
    const reshade = () => {
      place();
      if (frame) shade(frame);
    };
    reshadeLatest.current = reshade;
    const stopTracking = (event: Event) => {
      if (event.target !== island) return;
      if (tracking) cancelAnimationFrame(tracking);
      tracking = 0;
      reshade();
    };
    const observer = new ResizeObserver(reshade);
    observer.observe(island);
    window.addEventListener("resize", place);
    island.addEventListener("transitionrun", startTracking);
    island.addEventListener("transitionend", stopTracking);
    island.addEventListener("transitioncancel", stopTracking);

    const capture = sharedCapture.join(onMessage, (deliver) => {
      const channel = new Channel<GlassCaptureData>();
      channel.onmessage = deliver;
      return startGlassCapture(channel, options.current.blur, options.current.saturation);
    });
    void capture.started.then(
      (result) => {
        if (alive && !result.started) report({ state: "failed", reason: result.reason ?? "unsupported" });
      },
      () => alive && report({ state: "failed", reason: "failed" }),
    );

    return () => {
      alive = false;
      reshadeLatest.current = () => {};
      if (tracking) cancelAnimationFrame(tracking);
      observer.disconnect();
      window.removeEventListener("resize", place);
      island.removeEventListener("transitionrun", startTracking);
      island.removeEventListener("transitionend", stopTracking);
      island.removeEventListener("transitioncancel", stopTracking);
      delete island.dataset.glassLive;
      island.style.removeProperty("--glass-live-frost");
      setLive(STARTING);
      capture.leave();
    };
  }, [enabled, target]);

  useEffect(() => {
    if (!enabled || !isTauri()) return;
    void setGlassCaptureOptions(blur, saturation).catch(() => {});
  }, [enabled, blur, saturation, devicePixelRatio]);

  return enabled ? live : STARTING;
}
