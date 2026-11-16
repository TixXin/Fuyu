import { Music2 } from "lucide-react";
import { defineSlot } from "../../plugin-kernel/slots";
import { KaraokeText } from "../lyrics/KaraokeText";
import { mediaIsland } from "./islandState";
import { OWNER } from "./owner.ts";

type LineContext = {
  showTitle: boolean;
};

const lineSlot = defineSlot<LineContext>("island.line/v1");

function LyricLine({ showTitle }: LineContext) {
  const lyric = mediaIsland.use()?.lyricLine;
  if (!lyric?.text) return null;
  return (
    <span className="island__agent-session island__lyric" key={`lyric:${lyric.index}`}>
      {showTitle && <span className="island__agent-session-separator">·</span>}
      <Music2 className="island__agent-session-bot" size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span className="island__agent-session-title" aria-label={lyric.karaoke ? lyric.text ?? undefined : undefined}>
        {lyric.karaoke ? (
          <KaraokeText key={lyric.karaoke.clock} words={lyric.karaoke.words} positionMs={lyric.karaoke.positionMs} sampledAt={lyric.karaoke.sampledAt} playing look={lyric.karaoke.look} />
        ) : lyric.text}
      </span>
    </span>
  );
}

lineSlot.add({ id: "media.lyric", component: LyricLine }, OWNER);
