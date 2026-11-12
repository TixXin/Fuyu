import { useCallback, useState } from "react";
import { loadSongOffsets, saveSongOffsets, setSongOffset } from "./songOffsets";

export function useSongOffset(key: string | null): [number, (ms: number) => void] {
  const [offsets, setOffsets] = useState(loadSongOffsets);
  const change = useCallback(
    (ms: number) => {
      if (!key) return;
      setOffsets((current) => {
        const next = setSongOffset(current, key, ms);
        saveSongOffsets(next);
        return next;
      });
    },
    [key],
  );
  return [key ? offsets[key] ?? 0 : 0, change];
}
