import type { MonitorWallpaper, Wallpapers } from "../settings/api.ts";
import { isLightIsland, relativeLuminance } from "../../utils/color.ts";

export type ScreenRect = { x: number; y: number; width: number; height: number };
export type ImageSize = { width: number; height: number };

export type WallpaperPlacement = {
  image: string | null;
  color: string;
  target: ScreenRect;
};

function contains(monitor: MonitorWallpaper, x: number, y: number) {
  return x >= monitor.x && x < monitor.x + monitor.width && y >= monitor.y && y < monitor.y + monitor.height;
}

function distance(monitor: MonitorWallpaper, x: number, y: number) {
  const dx = Math.max(monitor.x - x, 0, x - (monitor.x + monitor.width));
  const dy = Math.max(monitor.y - y, 0, y - (monitor.y + monitor.height));
  return dx * dx + dy * dy;
}

function union(monitors: MonitorWallpaper[]): ScreenRect {
  const left = Math.min(...monitors.map((monitor) => monitor.x));
  const top = Math.min(...monitors.map((monitor) => monitor.y));
  const right = Math.max(...monitors.map((monitor) => monitor.x + monitor.width));
  const bottom = Math.max(...monitors.map((monitor) => monitor.y + monitor.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function monitorUnder(monitors: MonitorWallpaper[], island: ScreenRect) {
  const x = island.x + island.width / 2;
  const y = island.y + island.height / 2;
  return monitors.find((monitor) => contains(monitor, x, y))
    ?? [...monitors].sort((a, b) => distance(a, x, y) - distance(b, x, y))[0];
}

export function placeImage(area: ScreenRect, size: ImageSize, fit: Wallpapers["fit"]): ScreenRect {
  if (fit === "stretch") return area;
  const scaleX = area.width / size.width;
  const scaleY = area.height / size.height;
  const scale = fit === "fit" ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
  const width = size.width * scale;
  const height = size.height * scale;
  return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
}

export function wallpaperPlacement(wallpapers: Wallpapers, island: ScreenRect, sizeOf: (image: string) => ImageSize | null): WallpaperPlacement | null {
  const monitor = monitorUnder(wallpapers.monitors, island);
  if (!monitor) return null;
  const area = wallpapers.fit === "span" ? union(wallpapers.monitors) : monitor;
  const size = monitor.image ? sizeOf(monitor.image) : null;
  if (!monitor.image || !size) {
    return monitor.image ? null : { image: null, color: wallpapers.color, target: area };
  }
  return { image: monitor.image, color: wallpapers.color, target: placeImage(area, size, wallpapers.fit) };
}

export function sampleBox(target: ScreenRect, island: ScreenRect) {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    left: clamp((island.x - target.x) / target.width),
    top: clamp((island.y - target.y) / target.height),
    right: clamp((island.x + island.width - target.x) / target.width),
    bottom: clamp((island.y + island.height - target.y) / target.height),
  };
}

export type BackdropLuminance = { dark: number; bright: number };

const SPREAD_TAIL = 0.1;
const READABLE_UNDER_INK = { light: 0.4, dark: 0.08 };
const MAX_FROST = 0.95;
const FROST_STEP = 20;

export function luminanceSpread(values: number[]): BackdropLuminance | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
  return { dark: at(SPREAD_TAIL), bright: at(1 - SPREAD_TAIL) };
}

const perceived = (luminance: number) => Math.max(0, luminance) ** (1 / 2.2);

export function contrastFrost(backdrop: BackdropLuminance, islandBackground: string) {
  const light = isLightIsland(islandBackground);
  const target = perceived(light ? READABLE_UNDER_INK.light : READABLE_UNDER_INK.dark);
  const under = perceived(light ? backdrop.dark : backdrop.bright);
  const tint = perceived(relativeLuminance(islandBackground));
  const short = light ? target - under : under - target;
  if (short <= 0) return 0;
  const reach = light ? tint - under : under - tint;
  const needed = reach <= 0 ? MAX_FROST : Math.min(MAX_FROST, short / reach);
  return Math.min(MAX_FROST, Math.ceil(needed * FROST_STEP - 1e-9) / FROST_STEP);
}

export function settleFrost(current: number, next: number) {
  return next > current || Math.round((current - next) * FROST_STEP) >= 2 ? next : current;
}
