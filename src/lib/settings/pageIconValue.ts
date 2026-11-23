export type PageIconValue =
  | { kind: "name"; name: string }
  | { kind: "emoji"; emoji: string; mono: boolean }
  | { kind: "text"; text: string; bold: boolean }
  | { kind: "image"; id: string };

export const PAGE_ICON_VALUE_MAX = 40;

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Z}]/gu;
const IMAGE_ID = /^[a-z0-9]{6,24}$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type GraphemeSegmenter = { segment(input: string): Iterable<{ segment: string }> };
type SegmenterClass = new (locale: undefined, options: { granularity: "grapheme" }) => GraphemeSegmenter;

let segmenter: GraphemeSegmenter | null | undefined;

export function graphemes(value: string): string[] {
  if (segmenter === undefined) {
    const Segmenter = (Intl as unknown as { Segmenter?: SegmenterClass }).Segmenter;
    segmenter = typeof Segmenter === "function" ? new Segmenter(undefined, { granularity: "grapheme" }) : null;
  }
  return segmenter ? Array.from(segmenter.segment(value), (part) => part.segment) : Array.from(value);
}

export const isEmoji = (value: string) => EMOJI.test(value);
export const isWideText = (value: string) => WIDE.test(value);

export function firstEmoji(input: string): string | null {
  const found = graphemes(input.trim()).find(isEmoji);
  return found ?? null;
}

export function textLimit(text: string): number {
  return isWideText(text) ? 2 : 3;
}

export function clampPageText(input: string): string {
  const parts = graphemes(input.replace(CONTROL, "")).filter((part) => !isEmoji(part));
  return parts.slice(0, textLimit(parts.join(""))).join("");
}

export function parsePageIcon(raw: string | undefined | null): PageIconValue | null {
  if (!raw || raw.length > PAGE_ICON_VALUE_MAX) return null;
  const colon = raw.indexOf(":");
  if (colon < 0) return NAME.test(raw) ? { kind: "name", name: raw } : null;
  const prefix = raw.slice(0, colon);
  const rest = raw.slice(colon + 1);
  if (prefix === "emoji" || prefix === "emoji-mono") {
    const parts = graphemes(rest);
    return parts.length === 1 && isEmoji(rest) ? { kind: "emoji", emoji: rest, mono: prefix === "emoji-mono" } : null;
  }
  if (prefix === "text" || prefix === "text-light") {
    return rest !== "" && clampPageText(rest) === rest ? { kind: "text", text: rest, bold: prefix === "text" } : null;
  }
  if (prefix === "image") return IMAGE_ID.test(rest) ? { kind: "image", id: rest } : null;
  return null;
}

export function formatPageIcon(value: PageIconValue): string {
  switch (value.kind) {
    case "name":
      return value.name;
    case "emoji":
      return `${value.mono ? "emoji-mono" : "emoji"}:${value.emoji}`;
    case "text":
      return `${value.bold ? "text" : "text-light"}:${value.text}`;
    case "image":
      return `image:${value.id}`;
  }
}
