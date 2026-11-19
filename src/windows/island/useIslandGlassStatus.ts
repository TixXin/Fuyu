import { useMemo, useSyncExternalStore } from "react";
import { isMacOS } from "../../lib/platform";
import type { IslandSettings } from "../../lib/settings/types";
import { resolveGlassStatus, type GlassLayerState, type LiveBackdropState } from "./glassStatus";
import type { NativeGlassState } from "./types";
import { useGlassStatusBroadcast } from "./useGlassStatusBroadcast";

const TRANSPARENCY_QUERY = "(prefers-reduced-transparency: reduce)";

function subscribeTransparency(onChange: () => void): () => void {
  const media = window.matchMedia(TRANSPARENCY_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useReducedTransparency(): boolean {
  return useSyncExternalStore(subscribeTransparency, () => window.matchMedia(TRANSPARENCY_QUERY).matches, () => false);
}

function macLive(state: NativeGlassState): LiveBackdropState {
  if (state === "active") return { state: "live" };
  if (state === "css-fallback") return { state: "failed", reason: "unsupported" };
  return { state: "starting" };
}

export function useIslandGlassStatus({
  settings,
  nativeGlassState,
  layer,
}: {
  settings: IslandSettings;
  nativeGlassState: NativeGlassState;
  layer: GlassLayerState;
}) {
  const transparencyOff = useReducedTransparency();
  const enabled = settings.appearanceMode === "liquidGlass";
  const live = isMacOS ? macLive(nativeGlassState) : layer.live;
  const { backdrop, reason } = resolveGlassStatus({
    enabled,
    choice: settings.glassBackdrop,
    transparencyOff,
    live,
    wallpaper: layer.wallpaper,
  });
  const status = useMemo(() => (reason ? { backdrop, reason } : { backdrop }), [backdrop, reason]);
  useGlassStatusBroadcast(status);
  return status;
}
