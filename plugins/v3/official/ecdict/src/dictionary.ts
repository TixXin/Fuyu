import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeInflection, lemmatizeEnglish } from "./lemmatize.ts";
import type { Direction, EcdictData, EntryTuple } from "./types.ts";

const HAN_RE = /[\u3400-\u9fff]/;
const EDGE_PUNCT_RE =
  /^[\s"'“”‘’`([{<（【《「『.,!?;:，。！？；：~]+|[\s"'“”‘’`)\]}>）】》」』.,!?;:，。！？；：~]+$/g;
const POS_PREFIX_RE = /^(?:[a-z]{1,6}\.\s*|\[[^\]]+\]\s*)+/i;
const PAREN_NOTE_RE = /（[^）]*）|\([^)]*\)/g;

export const LONG_SENTENCE_MESSAGE = [
  "离线词典仅支持单词、短语与简短词组查询，暂不支持整句或段落翻译。如需长句互译，请在「设置 → 翻译 → 翻译服务」中切换至大模型或在线翻译服务。",
  "The offline dictionary only supports words and short phrases. For full-sentence or paragraph translation, switch to an LLM or online translation service in Settings → Translation.",
].join("\n");

interface ReverseItem {
  readonly word: string;
  readonly phonetic: string;
  readonly summary: string;
  readonly glosses: readonly string[];
}

export interface EcdictEngine {
  readonly size: number;
  translate(text: string, direction?: Direction): string;
}

export function normalizeQuery(raw: string): string {
  return raw.trim().replace(EDGE_PUNCT_RE, "").replace(/[ \t]+/g, " ").trim();
}

function formatHeader(word: string, phonetic: string): string {
  return phonetic ? `${word}  /${phonetic}/` : word;
}

function oneLineSummary(translation: string): string {
  return translation
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join("；");
}

function extractChineseGlosses(translation: string): string[] {
  const glosses: string[] = [];
  for (const rawLine of translation.split("\n")) {
    const stripped = rawLine.replace(POS_PREFIX_RE, "").replace(PAREN_NOTE_RE, "").trim();
    if (!stripped) continue;
    for (const part of stripped.split(/[,，;；、/|]/)) {
      const token = part.replace(POS_PREFIX_RE, "").trim();
      if (token && HAN_RE.test(token)) {
        glosses.push(token);
      }
    }
  }
  return glosses;
}

function buildReverseIndex(entries: Readonly<Record<string, EntryTuple>>): ReverseItem[] {
  const items: ReverseItem[] = [];
  for (const [word, [phonetic, translation]] of Object.entries(entries)) {
    const glosses = extractChineseGlosses(translation);
    if (glosses.length === 0) continue;
    items.push({
      word,
      phonetic,
      summary: oneLineSummary(translation),
      glosses,
    });
  }
  return items;
}

function isLongSentence(
  raw: string,
  cleaned: string,
  hasHan: boolean,
  entries: Readonly<Record<string, EntryTuple>>,
): boolean {
  if (/[\r\n]/.test(raw.trim())) return true;
  if (!cleaned) return false;
  if (!hasHan && Object.hasOwn(entries, cleaned.toLowerCase())) return false;

  if (hasHan) {
    const chars = [...cleaned].length;
    if (chars > 10) return true;
    if (/[，。；！？,.;!?]/.test(cleaned)) return true;
    if (/[A-Za-z]/.test(cleaned) && chars > 8) return true;
    return false;
  }

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length > 5 || cleaned.length > 48) return true;
  if (words.length >= 4 && /[,.;!?]/.test(cleaned)) return true;
  return false;
}

function suggestSimilar(key: string, entries: Readonly<Record<string, EntryTuple>>): string[] {
  if (key.length < 3 || key.includes(" ")) return [];
  const prefix = key.slice(0, Math.min(key.length, 4));
  const matches: string[] = [];
  for (const word of Object.keys(entries)) {
    if (word !== key && !word.includes(" ") && word.startsWith(prefix) && Math.abs(word.length - key.length) <= 3) {
      matches.push(word);
      if (matches.length >= 4) break;
    }
  }
  return matches;
}

function notFoundMessage(query: string, suggestions: readonly string[]): string {
  const lines = [
    `未在离线词典中找到“${query}”。请检查拼写，或在「设置 → 翻译 → 翻译服务」中切换至大模型或在线翻译服务。`,
    `No offline dictionary entry found for "${query}". Check the spelling or switch to an LLM or online service in Settings → Translation.`,
  ];
  if (suggestions.length > 0) {
    lines.push(`相近词条 / Similar: ${suggestions.join(", ")}`);
  }
  return lines.join("\n");
}

function lookupEnglish(cleaned: string, data: EcdictData): string {
  const key = cleaned.toLowerCase();
  const direct = Object.hasOwn(data.entries, key) ? data.entries[key] : undefined;
  const form = Object.hasOwn(data.forms, key) ? data.forms[key] : undefined;

  if (direct) {
    const blocks = [`${formatHeader(key, direct[0])}\n${direct[1]}`];
    if (form && form[0] !== key && Object.hasOwn(data.entries, form[0])) {
      const base = data.entries[form[0]];
      blocks.push(
        `原形：${form[0]}（${describeInflection(form[1])}）\n${formatHeader(form[0], base[0])}\n${base[1]}`,
      );
    }
    return blocks.join("\n\n");
  }

  const resolved = lemmatizeEnglish(key, data.entries, data.forms);
  if (resolved) {
    const base = data.entries[resolved.lemma];
    return [
      `${key} → 原形：${resolved.lemma}（${describeInflection(resolved.kind)}）`,
      formatHeader(resolved.lemma, base[0]),
      base[1],
    ].join("\n");
  }

  return notFoundMessage(cleaned, suggestSimilar(key, data.entries));
}

function scoreChineseCandidate(query: string, bareQuery: string, glosses: readonly string[]): number {
  let best = 99;
  for (const gloss of glosses) {
    if (gloss === query) return 0;
    if (gloss === `${query}的` || (bareQuery !== query && gloss === bareQuery)) {
      best = Math.min(best, 1);
    } else if (gloss.startsWith(query) && gloss.length <= query.length + 4) {
      best = Math.min(best, 2);
    } else if (gloss.includes(query) && gloss.length <= query.length + 6) {
      best = Math.min(best, 3);
    }
  }
  return best;
}

function lookupChinese(cleaned: string, index: readonly ReverseItem[]): string {
  const bareQuery = cleaned.length > 1 && cleaned.endsWith("的") ? cleaned.slice(0, -1) : cleaned;
  const ranked: Array<{ item: ReverseItem; tier: number }> = [];

  for (const item of index) {
    const tier = scoreChineseCandidate(cleaned, bareQuery, item.glosses);
    if (tier < 99) {
      ranked.push({ item, tier });
    }
  }

  if (ranked.length === 0) {
    return notFoundMessage(cleaned, []);
  }

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const aPhrase = a.item.word.includes(" ") ? 1 : 0;
    const bPhrase = b.item.word.includes(" ") ? 1 : 0;
    if (aPhrase !== bPhrase) return aPhrase - bPhrase;
    if (a.item.word.length !== b.item.word.length) return a.item.word.length - b.item.word.length;
    return a.item.word.localeCompare(b.item.word);
  });

  return ranked
    .slice(0, 6)
    .map(({ item }) => `${formatHeader(item.word, item.phonetic)} — ${item.summary}`)
    .join("\n");
}

export function createEcdictEngine(data: EcdictData): EcdictEngine {
  let reverseCache: ReverseItem[] | null = null;
  const getReverseIndex = (): ReverseItem[] => {
    if (!reverseCache) {
      reverseCache = buildReverseIndex(data.entries);
    }
    return reverseCache;
  };

  return {
    size: Object.keys(data.entries).length,
    translate(rawText: string, direction: Direction = "auto"): string {
      const cleaned = normalizeQuery(rawText);
      if (!cleaned) {
        return notFoundMessage(rawText.trim(), []);
      }
      const hasHan = HAN_RE.test(cleaned);
      const hasLatin = /[A-Za-z]/.test(cleaned);
      const preferChinese = hasHan && (direction !== "en-zh" || !hasLatin);
      if (isLongSentence(rawText, cleaned, preferChinese || hasHan, data.entries)) {
        return LONG_SENTENCE_MESSAGE;
      }
      if (preferChinese) {
        return lookupChinese(cleaned, getReverseIndex());
      }
      return lookupEnglish(cleaned, data);
    },
  };
}

export function defaultDataPath(metaUrl = import.meta.url): string {
  const pluginRoot = dirname(dirname(fileURLToPath(metaUrl)));
  return join(pluginRoot, "assets", "ecdict.json");
}

export function loadDefaultEcdictEngine(metaUrl = import.meta.url): EcdictEngine {
  const raw = readFileSync(defaultDataPath(metaUrl), "utf8");
  const parsed = JSON.parse(raw) as EcdictData;
  return createEcdictEngine(parsed);
}
