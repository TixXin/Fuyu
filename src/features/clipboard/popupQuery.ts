import type { ClipboardHistoryItem } from "./api";
import { matchesClipboardQuery } from "./clipboardSearch.ts";
import { contentKind } from "./contentKind.ts";
import { isPinyinLoaded, loadedPinyin, loadPinyin, type PinyinOf } from "../../lib/pinyin/pinyin.ts";

export type PopupQuery = { words: string[]; rules: QueryRule[] };

export type QueryRule =
  | { rule: "app"; name: string }
  | { rule: "today" | "yesterday" | "week" }
  | { rule: "img" | "file" | "link" | "color" | "json" | "text" | "fav" };

const KEYWORDS = ["today", "yesterday", "week", "img", "file", "link", "color", "json", "text", "fav"] as const;
const ALIASES: Record<string, (typeof KEYWORDS)[number]> = { image: "img", images: "img", files: "file", links: "link", colors: "color", favorite: "fav", favorites: "fav" };

export function parsePopupQuery(query: string): PopupQuery {
  const words: string[] = [];
  const rules: QueryRule[] = [];
  for (const token of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    if (!token.startsWith("/") || token.length === 1) {
      if (token !== "/") words.push(token);
      continue;
    }
    const body = token.slice(1);
    if (body.startsWith("app:")) {
      if (body.length > 4) rules.push({ rule: "app", name: body.slice(4) });
      continue;
    }
    const keyword = ALIASES[body] ?? KEYWORDS.find((known) => known === body);
    if (keyword) rules.push({ rule: keyword });
    else if (![...KEYWORDS, "app:"].some((known) => known.startsWith(body))) words.push(token);
  }
  return { words, rules };
}

export { isPinyinLoaded, loadPinyin, type PinyinOf };

const ASCII_WORD = /^[a-z]+$/;

export function queryNeedsPinyin(query: PopupQuery): boolean {
  return query.words.some((word) => ASCII_WORD.test(word));
}

const pinyinCache = new Map<string, { full: string; initials: string }>();
const HAN = /[㐀-鿿]/;

function pinyinMatches(item: ClipboardHistoryItem, word: string, pinyin: PinyinOf): boolean {
  const key = `${item.id}\n${item.copiedAt}`;
  let entry = pinyinCache.get(key);
  if (!entry) {
    const source = [item.masked ? item.preview : item.text ?? item.preview, item.note ?? "", item.source?.name ?? "", item.ocrText ?? ""].join(" ").slice(0, 4000);
    entry = HAN.test(source) ? pinyin(source) : { full: "", initials: "" };
    if (pinyinCache.size > 2000) pinyinCache.clear();
    pinyinCache.set(key, entry);
  }
  return entry.full.includes(word) || entry.initials.includes(word);
}

const DAY_MS = 86_400_000;

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function ruleMatches(item: ClipboardHistoryItem, rule: QueryRule, now: number): boolean {
  switch (rule.rule) {
    case "app":
      return (item.source?.name ?? "").toLowerCase().includes(rule.name);
    case "today":
      return item.copiedAt >= startOfDay(now);
    case "yesterday":
      return item.copiedAt >= startOfDay(now) - DAY_MS && item.copiedAt < startOfDay(now);
    case "week":
      return item.copiedAt >= startOfDay(now) - 6 * DAY_MS;
    case "img":
      return item.kind === "image";
    case "file":
      return item.kind === "files";
    case "fav":
      return Boolean(item.favorite);
    case "text":
      return item.kind === "text";
    default:
      return contentKind(item)?.kind === rule.rule;
  }
}

export function matchesPopupQuery(item: ClipboardHistoryItem, query: PopupQuery, now: number, pinyin: PinyinOf | null = loadedPinyin()): boolean {
  if (!query.rules.every((rule) => ruleMatches(item, rule, now))) return false;
  return query.words.every((word) =>
    matchesClipboardQuery(item, word) || (pinyin !== null && ASCII_WORD.test(word) && pinyinMatches(item, word, pinyin)),
  );
}
