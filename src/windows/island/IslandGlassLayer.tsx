import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { IslandGlassShader } from "./IslandGlassShader";
import type { IslandGlassView } from "./useIslandGlass";
import { useWallpaperBackdrop } from "./useWallpaperBackdrop";
import "./IslandGlass.css";
import "./IslandGlassFlow.css";
import "./IslandGlassLight.css";
import "./IslandGlassWallpaper.css";

export function IslandGlassLayer({ glass }: { glass?: IslandGlassView }) {
  const [shaderFailed, setShaderFailed] = useState(false);
  const shader = glass?.shader === true && !shaderFailed;
  const fail = useCallback(() => setShaderFailed(true), []);
  const layer = useRef<HTMLDivElement>(null);
  const wallpaper = useWallpaperBackdrop({
    target: layer,
    enabled: glass?.backdrop === true,
    blur: glass?.blur ?? 0,
    saturation: glass?.saturation ?? 100,
    contrastGuard: glass?.contrastGuard !== false,
    lightIsland: glass?.light === true,
  });

  const wallpaperKey = wallpaper ? JSON.stringify(wallpaper) : "";
  const onLayerState = glass?.onLayerState;
  const wallpaperState = wallpaper ? "ready" : "loading";

  useEffect(() => {
    onLayerState?.({ live: { state: "failed", reason: "unsupported" }, wallpaper: wallpaperState });
  }, [onLayerState, wallpaperState]);

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
      <span className="island__glass-backdrop" />
      {wallpaper && <span className="island__glass-noise" />}
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
