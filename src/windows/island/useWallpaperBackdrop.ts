import { useEffect, useRef, useState, type RefObject } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getWallpapers, listenWallpaperChanged, type Wallpapers } from "../../lib/settings/api";
import { contrastBoost, sampleBox, wallpaperPlacement, type ScreenRect } from "../../lib/theme/wallpaperSlice";
import { frostImage, loadImage, regionLuminance, type Frosted } from "./wallpaperFrost";

type Island = ScreenRect & { scale: number };

function colorLuminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const linear = (channel: number) => (channel / 255) ** 2.2;
  return 0.2126 * linear((value >> 16) & 255) + 0.7152 * linear((value >> 8) & 255) + 0.0722 * linear(value & 255);
}

export type WallpaperBackdrop = Record<string, string>;

export function useWallpaperBackdrop({
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
}): WallpaperBackdrop | null {
  const [wallpapers, setWallpapers] = useState<Wallpapers | null>(null);
  const [island, setIsland] = useState<Island | null>(null);
  const [images, setImages] = useState(() => new Map<string, HTMLImageElement | null>());
  const [frosted, setFrosted] = useState<Frosted | null>(null);
  const loading = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const read = () => void getWallpapers().then((next) => alive && setWallpapers(next ?? null), () => alive && setWallpapers(null));
    const onVisible = () => document.visibilityState === "visible" && read();
    read();
    const stop = listenWallpaperChanged(read);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      void stop.then((unlisten) => unlisten(), () => {});
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !wallpapers) return;
    for (const monitor of wallpapers.monitors) {
      const source = monitor.image;
      if (!source || images.has(source) || loading.current.has(source)) continue;
      loading.current.add(source);
      void loadImage(source).then((image) => {
        loading.current.delete(source);
        setImages((current) => new Map(current).set(source, image));
      });
    }
  }, [enabled, wallpapers, images]);

  useEffect(() => {
    const element = target.current;
    if (!enabled || !element) return;
    const appWindow = getCurrentWindow();
    let origin = { x: 0, y: 0 };
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const box = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scale = element.offsetWidth ? box.width / element.offsetWidth : 1;
      setIsland({ x: origin.x + box.left * dpr, y: origin.y + box.top * dpr, width: box.width * dpr, height: box.height * dpr, scale: scale * dpr });
    };
    const moveTo = (position: { x: number; y: number } | undefined) => {
      origin = position ? { x: position.x, y: position.y } : origin;
      measure();
    };
    void appWindow.innerPosition().then(moveTo, () => moveTo(undefined));
    const stopMoved = appWindow.onMoved(({ payload }) => moveTo(payload));
    const stopScale = appWindow.onScaleChanged(() => measure());
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    document.addEventListener("transitionend", measure);
    document.addEventListener("animationend", measure);
    return () => {
      alive = false;
      void stopMoved.then((unlisten) => unlisten(), () => {});
      void stopScale.then((unlisten) => unlisten(), () => {});
      observer.disconnect();
      document.removeEventListener("transitionend", measure);
      document.removeEventListener("animationend", measure);
    };
  }, [enabled, target]);

  const placement = enabled && wallpapers && island
    ? wallpaperPlacement(wallpapers, island, (source) => {
      const image = images.get(source);
      return image ? { width: image.naturalWidth, height: image.naturalHeight } : null;
    })
    : null;
  const image = placement?.image ? images.get(placement.image) ?? null : null;
  const imageBlur = image && placement
    ? Math.round(((blur * (window.devicePixelRatio || 1) * image.naturalWidth) / placement.target.width) * 2) / 2
    : 0;

  const source = placement?.image ?? null;
  useEffect(() => {
    if (!image || !source) return;
    const timer = window.setTimeout(() => setFrosted(frostImage(image, source, imageBlur, saturation / 100)), 0);
    return () => window.clearTimeout(timer);
  }, [image, source, imageBlur, saturation]);

  if (!placement || !island) return null;
  const ready = placement.image ? frosted?.source === placement.image ? frosted : null : null;
  if (placement.image && !ready) return null;
  const luminance = ready ? regionLuminance(ready, sampleBox(placement.target, island)) : colorLuminance(placement.color);
  const local = (value: number) => `${(value / island.scale).toFixed(1)}px`;
  return {
    "--glass-wallpaper": ready ? `url("${ready.url}")` : "none",
    "--glass-wallpaper-color": placement.color,
    "--glass-wallpaper-size": `${local(placement.target.width)} ${local(placement.target.height)}`,
    "--glass-wallpaper-x": local(placement.target.x - island.x),
    "--glass-wallpaper-y": local(placement.target.y - island.y),
    "--glass-backdrop-boost": String(contrastGuard && luminance !== null ? contrastBoost(luminance, lightIsland) : 0),
  };
}
