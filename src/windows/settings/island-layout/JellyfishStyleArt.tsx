import { JellyfishMark } from "../../../components/jellyfish/JellyfishMark";
import { JellyfishStyleContext } from "../../../components/jellyfish/jellyfishStyleContext";
import type { JellyfishStyle } from "../../../lib/settings/types";
import "./JellyfishStyleArt.css";

const ART_HEIGHT = 48;

export function JellyfishStyleArt({ style }: { style: JellyfishStyle }) {
  return (
    <span className="jellyfish-style-art">
      <JellyfishStyleContext.Provider value={style}>
        <JellyfishMark mood="idle" paused height={ART_HEIGHT} />
      </JellyfishStyleContext.Provider>
    </span>
  );
}
