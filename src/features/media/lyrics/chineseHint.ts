const HAN = /[一-鿿]/;

export function suggestsChineseSources(
  track: { title: string | null; artist: string | null },
  settings: { lyricsOnline: boolean; lyricsChinese?: boolean },
  notFound: boolean,
) {
  return notFound && settings.lyricsOnline && settings.lyricsChinese !== true && HAN.test(`${track.title ?? ""}${track.artist ?? ""}`);
}
