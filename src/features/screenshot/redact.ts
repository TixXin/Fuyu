import type { ShapeAnnotation } from "./annotations.ts";
import type { PixelRect } from "./selection.ts";

export type OcrWord = { text: string; x: number; y: number; width: number; height: number };

type Range = { start: number; end: number };

const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯＀-￯]/;

const WHOLE: RegExp[] = [
  /[A-Za-z0-9._%+-]+\s?@\s?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  /(?<!\d)(?:\+?86[\s-]?)?1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g,
  /\+\d{1,3}[\s-]?\(?\d{2,4}\)?(?:[\s-]?\d{3,4}){2,3}(?!\d)/g,
  /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g,
  /(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{1,4}:){3,7}[0-9A-Fa-f]{1,4}(?![0-9A-Fa-f:])/g,
  /(?:sk-(?:ant-|proj-)?[\w-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[\w]{20,}|AKIA[0-9A-Z]{16}|xox[abposr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{6,})/g,
];

const LABELLED = /(?:api[_\s-]?key|access[_\s-]?key|secret|token|password|passwd|pwd|密码|口令|密钥|令牌)\s*[:=：]\s*([^\s,;，；]{4,})/gi;
const LONG_TOKEN = /(?<![\w\-+/=])[\w\-+/=]{32,}(?![\w\-+/=])/g;

export function lineText(words: readonly OcrWord[]): { text: string; spans: Range[] } {
  let text = "";
  const spans: Range[] = [];
  words.forEach((word, index) => {
    const previous = words[index - 1]?.text ?? "";
    if (index > 0 && !(CJK.test(previous.slice(-1)) && CJK.test(word.text.charAt(0)))) text += " ";
    spans.push({ start: text.length, end: text.length + word.text.length });
    text += word.text;
  });
  return { text, spans };
}

function collect(pattern: RegExp, text: string, pick: (found: RegExpExecArray) => Range | null): Range[] {
  const found: Range[] = [];
  for (const match of text.matchAll(pattern)) {
    const range = pick(match);
    if (range && range.end > range.start) found.push(range);
  }
  return found;
}

function mixed(token: string) {
  return /[a-z]/.test(token) && /[A-Z]/.test(token) && /\d/.test(token);
}

export function sensitiveRanges(text: string): Range[] {
  const whole = (match: RegExpExecArray) => ({ start: match.index, end: match.index + match[0].length });
  const found = [
    ...WHOLE.flatMap((pattern) => collect(pattern, text, whole)),
    ...collect(LABELLED, text, (match) => {
      const value = match[1];
      const start = match.index + match[0].length - value.length;
      return { start, end: start + value.length };
    }),
    ...collect(LONG_TOKEN, text, (match) => (mixed(match[0]) ? whole(match) : null)),
  ].sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function clip(rect: PixelRect, bounds: PixelRect): PixelRect | null {
  const left = Math.max(rect.x, bounds.x);
  const top = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

export function redactionRects(lines: readonly (readonly OcrWord[])[], selection: PixelRect, pad = 2): PixelRect[] {
  return lines.flatMap((words) => {
    const { text, spans } = lineText(words);
    return sensitiveRanges(text).flatMap((range) => {
      const hit = words.filter((_, index) => spans[index].start < range.end && spans[index].end > range.start);
      if (hit.length === 0) return [];
      const left = Math.min(...hit.map((word) => word.x));
      const top = Math.min(...hit.map((word) => word.y));
      const right = Math.max(...hit.map((word) => word.x + word.width));
      const bottom = Math.max(...hit.map((word) => word.y + word.height));
      const box = { x: Math.floor(left - pad), y: Math.floor(top - pad), width: Math.ceil(right - left + pad * 2), height: Math.ceil(bottom - top + pad * 2) };
      const clipped = clip(box, selection);
      return clipped ? [clipped] : [];
    });
  });
}

export function redactionMosaic(rect: PixelRect): ShapeAnnotation {
  const width = Math.max(2, rect.height / 6);
  return { kind: "mosaic", color: "#000000", width, from: { x: rect.x, y: rect.y }, to: { x: rect.x + rect.width, y: rect.y + rect.height }, auto: true };
}

export function newMosaics(rects: readonly PixelRect[], existing: readonly { kind: string; from?: { x: number; y: number }; to?: { x: number; y: number } }[]) {
  const taken = new Set(existing.flatMap((item) => (item.kind === "mosaic" && item.from && item.to ? [`${item.from.x},${item.from.y},${item.to.x},${item.to.y}`] : [])));
  return rects.map(redactionMosaic).filter((item) => !taken.has(`${item.from.x},${item.from.y},${item.to.x},${item.to.y}`));
}
