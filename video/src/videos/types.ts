import type { World } from "../app/world";
import type { ClutterWindow } from "../stage/Clutter";
import type { Director } from "../stage/director";
import type { EndCardCopy } from "../stage/EndCard";
import type { Format } from "../stage/stageState";

export type Lang = "zh" | "en";

export type VideoModule = {
  id: string;
  durationMs: number;
  windows: (lang: Lang, format: Format) => ClutterWindow[];
  endCard: (lang: Lang) => EndCardCopy;
  seed: (world: World, lang: Lang) => void;
  script: (director: Director, lang: Lang) => void;
};
