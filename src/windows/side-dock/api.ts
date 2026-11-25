import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { SideDockEdge } from "../../lib/settings/sideDocks";

export const SIDE_DOCK_OPEN_PAGE_EVENT = "side-dock-open-page";
export const SIDE_DOCK_HOVER_EVENT = "side-dock-hover";
export const SIDE_DOCK_PREVIEW_EVENT = "side-dock-preview";

export type SideDockOpenPagePayload = {
  edge: SideDockEdge;
  page: string;
};

export type SideDockHoverPayload = {
  edge: SideDockEdge;
  inside: boolean;
};

export type SideDockPreviewPayload = {
  edge: SideDockEdge;
  open: boolean;
};

export type SideDockGeometryShape = {
  expanded: boolean;
  stripWidth: number;
  stripHeight: number;
  gap: number;
};

export async function syncSideDock(
  edge: SideDockEdge,
  enabled: boolean,
  width: number,
  height: number,
  along: number,
): Promise<void> {
  if (!isTauri()) return;
  await invoke("sync_side_dock", { edge, enabled, width, height, along });
}

export async function setSideDockGeometry(
  edge: SideDockEdge,
  width: number,
  height: number,
  along: number,
  shape?: SideDockGeometryShape,
): Promise<void> {
  if (!isTauri()) return;
  await invoke("set_side_dock_geometry", {
    edge,
    width,
    height,
    along,
    ...(shape
      ? {
          expanded: shape.expanded,
          stripWidth: shape.stripWidth,
          stripHeight: shape.stripHeight,
          gap: shape.gap,
        }
      : {}),
  });
}

export async function setSideDockVisible(edge: SideDockEdge, visible: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("set_side_dock_visible", { edge, visible });
}

export async function requestSideDockPage(edge: SideDockEdge, page: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("request_side_dock_page", { edge, page });
}

export async function previewSideDock(edge: SideDockEdge, open: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("preview_side_dock", { edge, open });
}

export async function listenSideDockOpenPage(
  edge: SideDockEdge,
  onOpen: (page: string) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  return listen<SideDockOpenPagePayload>(SIDE_DOCK_OPEN_PAGE_EVENT, (event) => {
    if (event.payload?.edge === edge && typeof event.payload.page === "string") {
      onOpen(event.payload.page);
    }
  });
}

export async function listenSideDockHover(
  edge: SideDockEdge,
  onHover: (inside: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  return listen<SideDockHoverPayload>(SIDE_DOCK_HOVER_EVENT, (event) => {
    if (event.payload?.edge === edge && typeof event.payload.inside === "boolean") {
      onHover(event.payload.inside);
    }
  });
}

export async function listenSideDockPreview(
  edge: SideDockEdge,
  onPreview: (open: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  return listen<SideDockPreviewPayload>(SIDE_DOCK_PREVIEW_EVENT, (event) => {
    if (event.payload?.edge === edge && typeof event.payload.open === "boolean") {
      onPreview(event.payload.open);
    }
  });
}
