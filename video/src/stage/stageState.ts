import { createStore } from "./store";

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;
export const ISLAND_FRAME_WIDTH = 820;

export type Camera = { scale: number; x: number; y: number; ms: number };

export type StageState = {
  camera: Camera;
  caption: { id: number; kicker: string; text: string } | null;
  cursor: { x: number; y: number; ms: number; visible: boolean; pressed: boolean };
  islandVisible: boolean;
  clutter: "hidden" | "in" | "absorbed";
  dim: number;
  endCard: boolean;
};

export const stage = createStore<StageState>({
  camera: { scale: 1, x: STAGE_WIDTH / 2, y: 0, ms: 0 },
  caption: null,
  cursor: { x: 900, y: 520, ms: 0, visible: false, pressed: false },
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
