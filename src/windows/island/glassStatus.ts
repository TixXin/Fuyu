export const ISLAND_GLASS_STATUS_EVENT = "island-glass-status";
export const ISLAND_GLASS_STATUS_REQUEST_EVENT = "island-glass-status-request";

export type GlassBackdropStatus = "live" | "wallpaper" | "css" | "off";

export type GlassFallbackReason =
  | "unsupported"
  | "no-d3d"
  | "remote"
  | "failed"
  | "transparency-off"
  | "no-wallpaper";

export type IslandGlassStatus = {
  backdrop: GlassBackdropStatus;
  reason?: GlassFallbackReason;
};

export type GlassBackdropChoice = "native" | "wallpaper" | "none";

export type LiveBackdropState =
  | { state: "starting" }
  | { state: "live" }
  | { state: "failed"; reason: GlassFallbackReason };

export type WallpaperBackdropState = "loading" | "ready" | "unavailable";

export function resolveGlassStatus({
  enabled,
  choice,
  transparencyOff,
  live,
  wallpaper,
}: {
  enabled: boolean;
  choice: GlassBackdropChoice;
  transparencyOff: boolean;
  live: LiveBackdropState;
  wallpaper: WallpaperBackdropState;
}): IslandGlassStatus {
  if (!enabled) return { backdrop: "off" };
  if (choice === "none") return { backdrop: "css" };
  if (transparencyOff) return { backdrop: "css", reason: "transparency-off" };
  const liveReason = choice === "native" && live.state === "failed" ? live.reason : null;
  if (choice === "native" && liveReason === null) return { backdrop: "live" };
  if (wallpaper === "unavailable") return { backdrop: "css", reason: liveReason ?? "no-wallpaper" };
  return liveReason ? { backdrop: "wallpaper", reason: liveReason } : { backdrop: "wallpaper" };
}

export function sameGlassStatus(a: IslandGlassStatus | null, b: IslandGlassStatus): boolean {
  return a !== null && a.backdrop === b.backdrop && a.reason === b.reason;
}

export type GlassLayerState = {
  live: LiveBackdropState;
  wallpaper: WallpaperBackdropState;
};

export const INITIAL_GLASS_LAYER: GlassLayerState = { live: { state: "starting" }, wallpaper: "loading" };

export function sameGlassLayer(a: GlassLayerState, b: GlassLayerState): boolean {
  if (a.wallpaper !== b.wallpaper || a.live.state !== b.live.state) return false;
  return a.live.state !== "failed" || b.live.state !== "failed" || a.live.reason === b.live.reason;
}
