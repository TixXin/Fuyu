import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { IslandFrame } from "./app/boot";
import { createDirector } from "./stage/director";
import { island } from "./stage/island";
import { Stage } from "./stage/Stage";
import { soundCues, startSoundClock } from "./stage/sound";
import { FORMAT, stage } from "./stage/stageState";
import type { Lang, VideoModule } from "./videos/types";

const VIDEOS: Record<string, () => Promise<{ default: VideoModule }>> = {
  "001-one-island": () => import("./videos/001-one-island"),
  "002-agents": () => import("./videos/002-agents"),
  "003-messages": () => import("./videos/003-messages"),
  "004-one-day": () => import("./videos/004-one-day"),
};

const params = new URLSearchParams(location.search);
const lang: Lang = params.get("lang") === "en" ? "en" : "zh";
const id = params.get("v") ?? "001-one-island";
const video = (await VIDEOS[id]()).default;
if (video.initial) stage.set(video.initial);
const director = createDirector();
video.script(director, lang);

const ready = new Promise<void>((resolve) => {
  const timer = window.setInterval(() => {
    try {
      if (!island.has(".island")) return;
    } catch {
      return;
    }
    window.clearInterval(timer);
    resolve();
  }, 50);
});
(window as unknown as IslandFrame).__seed = (world) => video.seed(world, lang);

const control = {
  id: video.id,
  durationMs: typeof video.durationMs === "function" ? video.durationMs(lang) : video.durationMs,
  ready,
  play: () => {
    startSoundClock();
    director.play();
  },
  sounds: soundCues,
  bgm: video.bgm ?? null,
  stage,
  island,
};
Object.assign(window, { __video: control });

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Stage lang={lang} windows={video.windows(lang, FORMAT)} endCard={video.endCard(lang)} backdrop={video.backdrop?.(lang, FORMAT)} scenery={video.scenery?.(lang, FORMAT)} look={video.look ?? "promo"} />
  </StrictMode>,
);

if (!params.has("capture")) void ready.then(() => window.setTimeout(control.play, 600));
