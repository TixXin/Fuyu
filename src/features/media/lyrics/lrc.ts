export type LyricWord = { startMs: number; endMs: number; text: string };

export type LyricLine = { timeMs: number; text: string; translation?: string; words?: LyricWord[] };

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

function tagMs(minutes: string, seconds: string, fraction = "0") {
  const ms = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction);
  return Number(minutes) * 60_000 + Number(seconds) * 1000 + ms;
}

function wordsOf(text: string, lineMs: number): { text: string; words?: LyricWord[] } {
  const tags = [...text.matchAll(WORD_TAG)];
  if (tags.length === 0) return { text: text.trim() };
  const marks = tags.map((tag) => ({ ms: tagMs(tag[1], tag[2], tag[3]), at: tag.index, end: tag.index + tag[0].length }));
  const words: LyricWord[] = [];
  const lead = text.slice(0, marks[0].at);
  if (lead.trim()) words.push({ startMs: lineMs, endMs: marks[0].ms, text: lead });
  marks.forEach((mark, index) => {
    const next = marks[index + 1];
    const word = text.slice(mark.end, next ? next.at : text.length);
    if (word) words.push({ startMs: mark.ms, endMs: next ? next.ms : mark.ms, text: word });
  });
  if (words.length > 0) words[0] = { ...words[0], text: words[0].text.trimStart() };
  const plain = words.map((word) => word.text).join("").trim();
  return words.some((word) => word.text.trim()) ? { text: plain, words } : { text: plain };
}
const OFFSET_TAG = /^\[offset:\s*([+-]?\d+)\s*\]/i;

export function parseLrc(text: string): LyricLine[] {
  let offsetMs = 0;
  const lines: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const offset = OFFSET_TAG.exec(raw.trim());
    if (offset) {
      offsetMs = Number.parseInt(offset[1], 10);
      continue;
    }
    const times: number[] = [];
    let rest = raw;
    for (const match of raw.matchAll(TIME_TAG)) {
      times.push(tagMs(match[1], match[2], match[3]));
      rest = rest.replace(match[0], "");
    }
    if (times.length === 0) continue;
    const { text: lineText, words } = wordsOf(rest, times[0]);
    for (const timeMs of times) {
      const shift = timeMs - times[0];
      const moved = words?.map((word) => ({ ...word, startMs: word.startMs + shift, endMs: word.endMs + shift }));
      lines.push(moved ? { timeMs, text: lineText, words: moved } : { timeMs, text: lineText });
    }
  }
  const early = (ms: number) => Math.max(0, ms - offsetMs);
  return lines
    .map((line) => ({
      ...line,
      timeMs: early(line.timeMs),
      ...(line.words && { words: line.words.map((word) => ({ ...word, startMs: early(word.startMs), endMs: early(word.endMs) })) }),
    }))
    .sort((a, b) => a.timeMs - b.timeMs);
}

export function lineIndexAt(lines: LyricLine[], positionMs: number) {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].timeMs <= positionMs) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

export function playbackPosition(
  state: { positionMs: number; durationMs: number; updatedAt: number; playbackStatus: string },
  now: number,
) {
  const moved = state.playbackStatus === "playing" ? Math.max(0, now - state.updatedAt) : 0;
  const position = state.positionMs + moved;
  return state.durationMs > 0 ? Math.min(position, state.durationMs) : position;
}

export function trackKey(state: { title: string | null; artist: string | null; durationMs: number }) {
  return state.title ? `${state.title}\u001f${state.artist ?? ""}\u001f${Math.round(state.durationMs / 2000)}` : null;
}

export function withTranslations(lines: LyricLine[], translation: LyricLine[]): LyricLine[] {
  if (translation.length === 0) return lines;
  return lines.map((line) => {
    const match = translation.find((other) => Math.abs(other.timeMs - line.timeMs) < 50 && other.text);
    return match && line.text ? { ...line, translation: match.text } : line;
  });
}

export function wordFill(word: LyricWord, positionMs: number) {
  return { delayMs: Math.round(word.startMs - positionMs), durationMs: Math.max(1, word.endMs - word.startMs) };
}

export function lyricAt(lines: LyricLine[], positionMs: number): { index: number; text: string | null; nextAt: number | null } {
  const index = lineIndexAt(lines, positionMs);
  const text = index >= 0 ? lines[index].text.trim() || null : null;
  return { index, text, nextAt: index + 1 < lines.length ? lines[index + 1].timeMs : null };
}

export function longestLyric(lines: LyricLine[]): string {
  return lines.reduce((longest, line) => (line.text.trim().length > longest.length ? line.text.trim() : longest), "");
}

const EVEN_FILL_MAX_MS = 8_000;
const EVEN_FILL_MIN_MS = 600;
const SPLIT = /[぀-ヿ㐀-鿿가-힯豈-﫿]\s*|[^\s぀-ヿ㐀-鿿가-힯豈-﫿]+\s*|\s+/g;

export function karaokeWords(line: LyricLine, nextAt: number | null, even: boolean): LyricWord[] | undefined {
  if (line.words && line.words.length > 0) return line.words;
  const text = line.text.trim();
  if (!even || !text) return undefined;
  const pieces = text.match(SPLIT) ?? [text];
  const span = nextAt === null ? EVEN_FILL_MAX_MS : nextAt - line.timeMs;
  const duration = Math.min(EVEN_FILL_MAX_MS, Math.max(EVEN_FILL_MIN_MS, span * 0.85));
  const weight = (piece: string) => Math.max(1, piece.trim().length);
  const total = pieces.reduce((sum, piece) => sum + weight(piece), 0);
  let at = line.timeMs;
  return pieces.map((piece) => {
    const length = (duration * weight(piece)) / total;
    const word = { startMs: Math.round(at), endMs: Math.round(at + length), text: piece };
    at += length;
    return word;
  });
}
