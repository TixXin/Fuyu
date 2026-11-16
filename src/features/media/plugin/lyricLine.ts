import type { Translations } from "../../../i18n";
import { LINE_PRIORITY, type IslandLineContribution } from "../../plugin-kernel/islandContributions.ts";
import type { CurrentLyric } from "../lyrics/useCurrentLyric";

const ICON_TEXT = "MM";

export function lyricLineContribution(lyricLine: CurrentLyric | null, lyricsFirst: boolean, t: Translations): IslandLineContribution | null {
  if (!lyricLine) return null;
  const priority = lyricsFirst ? LINE_PRIORITY.lyricsFirst : LINE_PRIORITY.lyrics;
  const measure = lyricLine.longest !== null ? ICON_TEXT + lyricLine.longest : undefined;
  return lyricLine.text
    ? { kind: "line", item: "media.lyric", priority, measure, page: "music", lead: true, shareable: true, label: (lyricLine.song ? t.island.nowPlaying : t.island.lyricLine)(lyricLine.text) }
    : { kind: "line", item: "media.lyric", priority, measure, page: "music", lead: true, shareable: true, reserve: true };
}
