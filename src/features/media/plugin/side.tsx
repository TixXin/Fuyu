import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import type { MediaState } from "../api";
import { MusicWaveButton } from "../MusicWaveButton";

type SideContext = {
  mediaState: MediaState;
  showCover: boolean;
  onOpenPage: (page: "music") => void;
};

const sideSlot = defineSlot<SideContext>("island.side/v1");

function MusicRow({ mediaState, showCover, onOpenPage }: SideContext) {
  const t = useTranslation();
  const playing = mediaState.playbackStatus === "playing";
  const cover = showCover ? mediaState.thumbnail : null;
  if (cover) {
    return (
      <button
        type="button"
        className="island-side-cover"
        aria-label={t.island.openMusic}
        onClick={(event) => {
          event.stopPropagation();
          onOpenPage("music");
        }}
      >
        <img src={cover} alt="" draggable={false} />
        {playing && <span className="island-side-cover__playing" aria-hidden="true" />}
      </button>
    );
  }
  return <MusicWaveButton isAvailable isPlaying={playing} audioPeak={mediaState.audioPeak} label={t.island.openMusic} onClick={() => onOpenPage("music")} />;
}

sideSlot.add({ id: "music", order: 40, component: MusicRow });
