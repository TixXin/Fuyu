import { createStore } from "./store";

export type Format = "wide" | "vertical";

export const FORMAT: Format = new URLSearchParams(location.search).get("format") === "vertical" ? "vertical" : "wide";
export const STAGE_WIDTH = FORMAT === "vertical" ? 720 : 1280;
export const STAGE_HEIGHT = FORMAT === "vertical" ? 1280 : 720;
export const SCREEN_TOP = FORMAT === "vertical" ? 170 : 0;
export const SCREEN_HEIGHT = FORMAT === "vertical" ? 900 : 720;
export const ISLAND_FRAME_WIDTH = 820;
export const ZOOM = FORMAT === "vertical" ? { panel: 1.25, popup: 1.7, bar: 1.9 } : { panel: 1.25, popup: 1.9, bar: 2.3 };

export type Camera = { scale: number; x: number; y: number; ms: number };

export type StageState = {
  camera: Camera;
  title: string;
  caption: { id: number; kicker: string; text: string } | null;
  cursor: { x: number; y: number; ms: number; visible: boolean; pressed: boolean };
  islandVisible: boolean;
  clutter: "hidden" | "in" | "back" | "front" | "absorbed";
  dim: number;
  endCard: boolean;
};

export const stage = createStore<StageState>({
  camera: { scale: 1, x: STAGE_WIDTH / 2, y: 0, ms: 0 },
  title: "",
  caption: null,
  cursor: { x: STAGE_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.72, ms: 0, visible: false, pressed: false },
  islandVisible: false,
  clutter: "hidden",
  dim: 0,
  endCard: false,
});

let captionId = 0;

export function showCaption(kicker: string, text: string) {
  captionId += 1;
  stage.set({ caption: { id: captionId, kicker, text } });
}

export function hideCaption() {
  stage.set({ caption: null });
}

export function moveCamera(scale: number, ms = 900, x = STAGE_WIDTH / 2, y = 0) {
  stage.set({ camera: { scale, x, y, ms } });
}
