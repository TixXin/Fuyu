import { readString, writeString } from "../../lib/storage.ts";
import type { IslandEdge } from "./api.ts";
import type { IslandPage } from "./types";

export type IslandPosition = {
  x: number;
  y: number;
  edge?: IslandEdge;
  along?: number;
  taskbar?: true;
};

const ISLAND_EDGES: readonly IslandEdge[] = ["top", "left", "right", "bottom"];

export const ISLAND_POSITION_STORAGE_KEY = "fuyu-position";
export const ISLAND_LAST_PAGE_STORAGE_KEY = "fuyu-last-page";

export function loadIslandPosition(): IslandPosition | null {
  const stored = window.localStorage.getItem(ISLAND_POSITION_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const position = JSON.parse(stored) as Partial<IslandPosition>;
    if (
      typeof position.x !== "number" ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      return null;
    }

    const loaded: IslandPosition = { x: Math.round(position.x), y: Math.round(position.y) };
    if (position.edge && ISLAND_EDGES.includes(position.edge)) {
      loaded.edge = position.edge;
    }
    if (typeof position.along === "number" && position.along >= 0 && position.along <= 1) {
      loaded.along = position.along;
    }
    if (position.taskbar === true && loaded.edge === "bottom") {
      loaded.taskbar = true;
    }
    return loaded;
  } catch {
    return null;
  }
}

export function saveIslandPosition(position: IslandPosition) {
  window.localStorage.setItem(
    ISLAND_POSITION_STORAGE_KEY,
    JSON.stringify(position),
  );
}

export function clearIslandPosition() {
  window.localStorage.removeItem(ISLAND_POSITION_STORAGE_KEY);
}

export function loadLastIslandPage(): IslandPage | null {
  const stored = readString(ISLAND_LAST_PAGE_STORAGE_KEY)?.trim();
  return stored ? (stored as IslandPage) : null;
}

export function saveLastIslandPage(page: IslandPage) {
  writeString(ISLAND_LAST_PAGE_STORAGE_KEY, page);
}
