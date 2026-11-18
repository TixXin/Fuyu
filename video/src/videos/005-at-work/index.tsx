import type { VideoModule } from "../types";
import { BEAT } from "./beats";
import { copyFor } from "./copy";
import { Desktop } from "./desktop";
import { overlay } from "./overlay";
import { script } from "./script";
import { seed } from "./seed";

const video: VideoModule = {
  id: "005-at-work",
  durationMs: BEAT.total,
  bgm: "005-at-work.mp3",
  windows: () => [],
  backdrop: () => <Desktop />,
  overlay,
  look: "recording",
  initial: { cursor: { x: 900, y: 460, ms: 0, visible: false, pressed: false } },
  endCard: (lang) => copyFor(lang).end,
  seed,
  script,
};

export default video;
