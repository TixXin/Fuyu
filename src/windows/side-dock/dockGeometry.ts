import type { SideDocksSettings } from "../../lib/settings/sideDocks.ts";

export type SideDockVisualState = "handle" | "strip" | "drawer";

const HANDLE_PAD_X = 14;
const HANDLE_PAD_Y = 24;
const STRIP_PAD_X = 14;
const STRIP_PAD_Y = 24;
const DRAWER_PAD_X = 18;
const DRAWER_PAD_Y = 20;

export function stripWidthFor(settings: Pick<SideDocksSettings, "stripStyle"> & Partial<Pick<SideDocksSettings, "density">>): number {
  const compact = settings.density === "compact";
  if (settings.stripStyle === "icon") return compact ? 46 : 52;
  return compact ? 58 : 66;
}

export function stripHeightFor(
  itemCount: number,
  settings: Pick<SideDocksSettings, "stripStyle"> & Partial<Pick<SideDocksSettings, "density">>,
): number {
  if (itemCount <= 0) return 0;
  const compact = settings.density === "compact";
  const rowHeight = settings.stripStyle === "icon" ? (compact ? 36 : 40) : (compact ? 48 : 54);
  const gap = compact ? 3 : 5;
  return itemCount * rowHeight + Math.max(0, itemCount - 1) * gap + 18;
}

export function targetVisualStateOnTrigger(
  settings: Pick<SideDocksSettings, "stages" | "autoDrawer">,
  stripCount = 1,
): SideDockVisualState {
  if (settings.stages === 2 || stripCount <= 0) return "drawer";
  return settings.autoDrawer === "auto" ? "drawer" : "strip";
}

export function sideDockWindowSize(
  settings: Pick<SideDocksSettings, "stages" | "stripStyle" | "handleWidth" | "handleHeight" | "drawerWidth" | "drawerHeight" | "gap"> & Partial<Pick<SideDocksSettings, "density">>,
  visualState: SideDockVisualState,
  stripCount = 1,
): { width: number; height: number } {
  if (visualState === "handle") {
    return {
      width: settings.handleWidth + HANDLE_PAD_X,
      height: settings.handleHeight + HANDLE_PAD_Y,
    };
  }
  const hasStrip = settings.stages === 3 && stripCount > 0;
  const stripWidth = hasStrip ? stripWidthFor(settings) : 0;
  if (visualState === "strip" && hasStrip) {
    const stripHeight = Math.min(settings.drawerHeight, Math.max(84, stripHeightFor(stripCount, settings)));
    return {
      width: stripWidth + STRIP_PAD_X,
      height: stripHeight + STRIP_PAD_Y,
    };
  }
  const extraWidth = hasStrip ? stripWidth + settings.gap : 0;
  return {
    width: settings.drawerWidth + extraWidth + DRAWER_PAD_X,
    height: settings.drawerHeight + DRAWER_PAD_Y,
  };
}
