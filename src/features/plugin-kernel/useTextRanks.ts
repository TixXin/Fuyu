import { useMemo } from "react";
import { useTextOrder } from "../../lib/settings/collapsedText";
import type { LyricsIslandPriority } from "../../lib/settings/lyricsSettings";
import { textRanks, type TextRanks } from "./textRanks";

export function useTextRanks(lyricsPriority: LyricsIslandPriority): TextRanks {
  const { order, hidden } = useTextOrder(lyricsPriority);
  return useMemo(() => textRanks(order, hidden), [order, hidden]);
}
