import { useEffect, useRef, useState, type RefObject } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getWallpapers, listenWallpaperChanged, type Wallpapers } from "../../lib/settings/api";
import { contrastBoost, sampleBox, wallpaperPlacement, type ScreenRect } from "../../lib/theme/wallpaperSlice";
import { frostImage, loadImage, regionLuminance, type Frosted } from "./wallpaperFrost";

type Island = ScreenRect & { scale: number; originX: number; originY: number };
type LocalBox = { left: number; top: number; width: number; height: number; scale: number };

function colorLuminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const linear = (channel: number) => (channel / 255) ** 2.2;
  return 0.2126 * linear((value >> 16) & 255) + 0.7152 * linear((value >> 8) & 255) + 0.0722 * linear(value & 255);
}

function sameIsland(a: Island | null, b: Island): boolean {
  return a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.scale === b.scale && a.originX === b.originX && a.originY === b.originY;
}

export type WallpaperBackdrop = Record<string, string>;

export type WallpaperBackdropResult = { variables: WallpaperBackdrop | null; unavailable: boolean };

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
}): WallpaperBackdropResult {
  const [wallpapers, setWallpapers] = useState<Wallpapers | null | undefined>(undefined);
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
    let localBox: LocalBox | null = null;
    let needsBox = true;
    let frame = 0;
    let settle = 0;
    let alive = true;

    const readBox = () => {
      const box = element.getBoundingClientRect();
      const scale = element.offsetWidth ? box.width / element.offsetWidth : 1;
      localBox = { left: box.left, top: box.top, width: box.width, height: box.height, scale };
      needsBox = false;
    };

    const commit = () => {
      if (!alive) return;
      if (needsBox || !localBox) readBox();
      if (!localBox) return;
      const dpr = window.devicePixelRatio || 1;
      const next: Island = {
        x: origin.x + localBox.left * dpr,
        y: origin.y + localBox.top * dpr,
        width: localBox.width * dpr,
        height: localBox.height * dpr,
        scale: localBox.scale * dpr,
        originX: origin.x,
        originY: origin.y,
      };
      setIsland((prev) => (sameIsland(prev, next) ? prev : next));
    };

    const schedule = (reReadBox: boolean) => {
      if (reReadBox) needsBox = true;
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        commit();
      });
    };

    const initPosition = (position: { x: number; y: number } | undefined) => {
      origin = position ? { x: position.x, y: position.y } : origin;
      commit();
    };
    const onLayoutChange = () => schedule(true);
    const onResize = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(onLayoutChange, 120);
    };

    void appWindow.innerPosition().then(initPosition, () => initPosition(undefined));
    const stopMoved = appWindow.onMoved(({ payload }) => {
      if (payload) origin = { x: payload.x, y: payload.y };
      schedule(false);
    });
    const stopScale = appWindow.onScaleChanged(onLayoutChange);
    const observer = new ResizeObserver(onResize);
    observer.observe(element);
    document.addEventListener("transitionend", onResize);
    document.addEventListener("animationend", onResize);
    return () => {
      alive = false;
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      void stopMoved.then((unlisten) => unlisten(), () => {});
      void stopScale.then((unlisten) => unlisten(), () => {});
      observer.disconnect();
      document.removeEventListener("transitionend", onResize);
      document.removeEventListener("animationend", onResize);
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
    let alive = true;
    const timer = window.setTimeout(() => void frostImage(image, source, imageBlur, saturation / 100).then((next) => {
      if (alive) setFrosted(next);
      else URL.revokeObjectURL(next.url);
    }), 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [image, source, imageBlur, saturation]);

  useEffect(() => () => {
    if (frosted) URL.revokeObjectURL(frosted.url);
  }, [frosted]);

  const unavailable = enabled && (wallpapers === null
    || (wallpapers !== undefined && island !== null && !placement)
    || (placement?.image ? images.get(placement.image) === null : false));
  if (!placement || !island) return { variables: null, unavailable };
  const ready = placement.image ? frosted?.source === placement.image ? frosted : null : null;
  if (placement.image && !ready) return { variables: null, unavailable };
  const luminance = ready ? regionLuminance(ready, sampleBox(placement.target, island)) : colorLuminance(placement.color);
  const local = (value: number) => `${(value / island.scale).toFixed(1)}px`;
  const variables = {
    "--glass-wallpaper": ready ? `url("${ready.url}")` : "none",
    "--glass-wallpaper-color": placement.color,
    "--glass-wallpaper-size": `${local(placement.target.width)} ${local(placement.target.height)}`,
    "--glass-wallpaper-x": local(placement.target.x - island.originX),
    "--glass-wallpaper-y": local(placement.target.y - island.originY),
    "--glass-backdrop-boost": String(contrastGuard && luminance !== null ? contrastBoost(luminance, lightIsland) : 0),
  };
  return { variables, unavailable: false };
}
