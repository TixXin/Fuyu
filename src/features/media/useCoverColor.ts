import { useEffect, useState } from "react";
import { COVER_SAMPLE_SIZE, coverAccents, pickCoverColor } from "./coverColor";
import "./coverColor.css";

const DEFAULT_ACCENT = "#74d6ff";
const CACHE_LIMIT = 24;
const HOLD_MS = 1_500;
const cache = new Map<string, string | null>();

function remember(thumbnail: string, color: string | null) {
  cache.delete(thumbnail);
  cache.set(thumbnail, color);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

function sample(thumbnail: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = COVER_SAMPLE_SIZE;
        canvas.height = COVER_SAMPLE_SIZE;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, COVER_SAMPLE_SIZE, COVER_SAMPLE_SIZE);
        resolve(pickCoverColor(context.getImageData(0, 0, COVER_SAMPLE_SIZE, COVER_SAMPLE_SIZE).data));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = thumbnail;
  });
}

export function useCoverColor(thumbnail: string | null, enabled: boolean): string | null {
  const [color, setColor] = useState<string | null>(() => (enabled && thumbnail ? cache.get(thumbnail) ?? null : null));

  useEffect(() => {
    if (!enabled) {
      setColor(null);
      return;
    }
    if (!thumbnail) {
      const timer = window.setTimeout(() => setColor(null), HOLD_MS);
      return () => window.clearTimeout(timer);
    }
    if (cache.has(thumbnail)) {
      setColor(cache.get(thumbnail) ?? null);
      return;
    }
    let live = true;
    void sample(thumbnail).then((picked) => {
      remember(thumbnail, picked);
      if (live) setColor(picked);
    });
    return () => {
      live = false;
    };
  }, [enabled, thumbnail]);

  return color;
}

export function coverAccentVariables(color: string | null, islandBackground: string, accent: string | null): Record<string, string> {
  const { dark, light } = coverAccents(color ?? accent ?? DEFAULT_ACCENT, islandBackground);
  return { "--cover-accent-dark": dark, "--cover-accent-light": light };
}
