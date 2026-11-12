import { useState, type CSSProperties } from "react";
import { PET_CELL_HEIGHT, PET_CELL_WIDTH, petSheetRows, petSpriteLayout, type PetMood } from "./patterns";
import "./PetSprite.css";

type PetSpriteProps = {
  src: string;
  mood: PetMood;
  paused?: boolean;
  height?: number;
};

const knownRows = new Map<string, number | null>();

export function PetSprite({ src, mood, paused = false, height = 22 }: PetSpriteProps) {
  const [sheet, setSheet] = useState<{ src: string; rows: number | null } | null>(null);
  const rows = sheet?.src === src ? sheet.rows : (knownRows.get(src) ?? null);
  const layout = petSpriteLayout(mood, rows ?? 9);
  const style = {
    "--pet-height": `${height}px`,
    "--pet-width": `${(height * PET_CELL_WIDTH) / PET_CELL_HEIGHT}px`,
    "--pet-row-shift": `${layout.rowShift}%`,
    "--pet-loop-shift": `${layout.loopShift}%`,
    "--pet-frames": layout.frames,
    "--pet-duration": `${layout.durationMs}ms`,
  } as CSSProperties;

  return (
    <span
      className="pet-sprite"
      style={style}
      data-mood={mood}
      data-ready={rows !== null || undefined}
      data-paused={paused || undefined}
      aria-hidden="true"
    >
      <span className="pet-sprite-row">
        <img
          key={mood}
          className="pet-sprite-sheet"
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            const loaded = petSheetRows(image.naturalWidth, image.naturalHeight);
            knownRows.set(src, loaded);
            setSheet({ src, rows: loaded });
          }}
        />
      </span>
    </span>
  );
}
