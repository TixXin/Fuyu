import type { VideoModule } from "../types";
import { copyFor } from "./copy";
import { desktop } from "./desktop";
import { beats, script } from "./script";
import { seed } from "./seed";

const video: VideoModule = {
  id: "003-messages",
  durationMs: (lang) => beats(lang).total,
  windows: () => [],
  backdrop: desktop,
  look: "recording",
  initial: { islandVisible: true, cursor: { x: 760, y: 420, ms: 0, visible: true, pressed: false } },
  bgm: "003-messages.mp3",
  endCard: (lang) => copyFor(lang).end,
  seed,
  script,
};

export default video;
