import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isMacOS } from "../../lib/platform";
import { IslandGlassShader } from "./IslandGlassShader";
import type { LiveBackdropState } from "./glassStatus";
import { useGlassCapture } from "./useGlassCapture";
import type { IslandGlassView } from "./useIslandGlass";
import { useReducedTransparency } from "./useIslandGlassStatus";
import { useWallpaperBackdrop } from "./useWallpaperBackdrop";
import "./IslandGlass.css";
import "./IslandGlassFlow.css";
import "./IslandGlassLight.css";
import "./IslandGlassLive.css";
import "./IslandGlassWallpaper.css";

const MAC_FAILED: LiveBackdropState = { state: "failed", reason: "unsupported" };
const MAC_LIVE: LiveBackdropState = { state: "live" };

export function IslandGlassLayer({ glass }: { glass?: IslandGlassView }) {
  const [shaderFailed, setShaderFailed] = useState(false);
  const shader = glass?.shader === true && !shaderFailed;
  const fail = useCallback(() => setShaderFailed(true), []);
  const layer = useRef<HTMLDivElement>(null);
  const transparencyOff = useReducedTransparency();
  const choice = glass?.choice ?? "none";
  const captureEnabled = !isMacOS && choice === "native" && !transparencyOff;
  const captured = useGlassCapture({
    target: layer,
    enabled: captureEnabled,
    blur: glass?.blur ?? 0,
    saturation: glass?.saturation ?? 100,
    contrastGuard: glass?.contrastGuard !== false,
    lightIsland: glass?.light === true,
  });
  const live = isMacOS ? (glass?.nativeState === "css-fallback" ? MAC_FAILED : MAC_LIVE) : captured;
  const wallpaperWanted = choice === "wallpaper" || (choice === "native" && live.state === "failed");
  const { variables: wallpaper, unavailable } = useWallpaperBackdrop({
    target: layer,
    enabled: wallpaperWanted,
    blur: glass?.blur ?? 0,
    saturation: glass?.saturation ?? 100,
    contrastGuard: glass?.contrastGuard !== false,
    lightIsland: glass?.light === true,
  });

  const wallpaperKey = wallpaper ? JSON.stringify(wallpaper) : "";
  const onLayerState = glass?.onLayerState;
  const wallpaperState = unavailable ? "unavailable" : wallpaper ? "ready" : "loading";

  useEffect(() => {
    onLayerState?.({ live, wallpaper: wallpaperState });
  }, [onLayerState, live, wallpaperState]);

  useLayoutEffect(() => {
    const island = layer.current?.closest<HTMLElement>(".island");
    if (!island || !wallpaperKey) return;
    const variables = Object.entries(JSON.parse(wallpaperKey) as Record<string, string>);
    island.dataset.glassWallpaper = "";
    for (const [name, value] of variables) island.style.setProperty(name, value);
    return () => {
      delete island.dataset.glassWallpaper;
      for (const [name] of variables) island.style.removeProperty(name);
    };
  }, [wallpaperKey]);

  return (
    <div ref={layer} className="island__glass" aria-hidden="true">
      {captureEnabled && (
        <span className="island__glass-live">
          <canvas />
        </span>
      )}
      <span className="island__glass-backdrop" />
      {(wallpaper || (captureEnabled && live.state === "live")) && <span className="island__glass-noise" />}
      {glass && !shader && (
        <span className="island__glass-flow">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {glass && shader && (
        <IslandGlassShader palette={glass.palette} paused={glass.paused} strength={glass.strength} onFail={fail} />
      )}
      <span className="island__glass-sheen" />
      <span className="island__glass-refraction" />
      <span className="island__glass-highlight" />
      <span className="island__glass-rim" />
    </div>
  );
}
