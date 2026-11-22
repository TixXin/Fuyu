import type { Translations } from "../../../i18n";
import type { IslandLineContribution } from "../../plugin-kernel/islandContributions.ts";
import type { CurrentLyric } from "../lyrics/useCurrentLyric";

const ICON_TEXT = "MM";

export function lyricLineContribution(lyricLine: CurrentLyric | null, priority: number | null, t: Translations): IslandLineContribution | null {
  if (!lyricLine || priority === null) return null;
  const measure = lyricLine.longest !== null ? ICON_TEXT + lyricLine.longest : undefined;
  return lyricLine.text
    ? { kind: "line", item: "media.lyric", priority, measure, page: "music", lead: true, shareable: true, label: (lyricLine.song ? t.island.nowPlaying : t.island.lyricLine)(lyricLine.text) }
    : { kind: "line", item: "media.lyric", priority, measure, page: "music", lead: true, shareable: true, reserve: true };
}
