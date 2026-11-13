import type { VideoModule } from "../types";
import { copyFor } from "./copy";
import { script } from "./script";
import { seed } from "./seed";
import { windows } from "./windows";

const video: VideoModule = {
  id: "002-agents",
  durationMs: 24_000,
  windows,
  endCard: (lang) => copyFor(lang).end,
  seed,
  script,
};

export default video;
