export type HistoryWord = { text: string; x: number; y: number; width: number; height: number };
export type HistoryLines = HistoryWord[][];
export type HistoryMatch<T> = { item: T; hits: HistoryWord[] };
export type MarkFrame = { left: number; top: number; width: number; height: number };

export function compactText(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
}

function lineHits(words: HistoryWord[], query: string): HistoryWord[] {
  const ranges: Array<{ word: HistoryWord; start: number; end: number }> = [];
  let joined = "";
  for (const word of words) {
    const text = compactText(word.text);
    if (!text) continue;
    ranges.push({ word, start: joined.length, end: joined.length + text.length });
    joined += text;
  }
  const hits = new Set<HistoryWord>();
  for (let at = joined.indexOf(query); at !== -1; at = joined.indexOf(query, at + 1)) {
    const end = at + query.length;
    for (const range of ranges) if (range.start < end && range.end > at) hits.add(range.word);
  }
  return [...hits];
}

export function findInLines(lines: HistoryLines | null | undefined, query: string): HistoryWord[] | null {
  const wanted = compactText(query);
  if (!wanted) return [];
  if (!lines) return null;
  const hits = lines.flatMap((words) => lineHits(words, wanted));
  return hits.length > 0 ? hits : null;
}

export function searchHistory<T extends { words?: HistoryLines | null }>(items: readonly T[], query: string): HistoryMatch<T>[] {
  return items.flatMap((item) => {
    const hits = findInLines(item.words, query);
    return hits ? [{ item, hits }] : [];
  });
}

export function coverFrame(width: number, height: number, frameAspect: number): MarkFrame {
  if (!(width > 0 && height > 0 && frameAspect > 0)) return { left: 0, top: 0, width: 100, height: 100 };
  const aspect = width / height;
  if (aspect >= frameAspect) {
    const wide = (aspect / frameAspect) * 100;
    return { left: (100 - wide) / 2, top: 0, width: wide, height: 100 };
  }
  return { left: 0, top: 0, width: 100, height: (frameAspect / aspect) * 100 };
}
