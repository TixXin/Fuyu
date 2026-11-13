import type { VideoModule } from "../types";
import { copyFor } from "./copy";
import { scenery } from "./scenes";
import { beats, script } from "./script";
import { seed } from "./seed";

const video: VideoModule = {
  id: "004-one-day",
  durationMs: (lang) => beats(lang).total,
  windows: () => [],
  scenery,
  look: "editorial",
  initial: { islandVisible: true, scene: "dawn", ink: "light" },
  bgm: "004-one-day.mp3",
  endCard: (lang) => copyFor(lang).end,
  seed,
  script,
};

export default video;
