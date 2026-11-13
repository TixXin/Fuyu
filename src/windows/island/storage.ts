import type { IslandEdge } from "./api.ts";

export type IslandPosition = {
  x: number;
  y: number;
  edge?: IslandEdge;
  along?: number;
};

const ISLAND_EDGES: readonly IslandEdge[] = ["top", "left", "right"];

export const ISLAND_POSITION_STORAGE_KEY = "fuyu-position";

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
