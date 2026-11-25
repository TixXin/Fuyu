import type { LocaleCode } from "../../i18n";
import type { SettingsCategory } from "./categories";

export type SettingsRowText = {
  group: string;
  title: string;
  description?: string;
  options?: string[];
};

export type SettingsSearchEntry = { page: SettingsCategory; since?: string } & Record<LocaleCode, SettingsRowText>;

export type SettingsRowHit = {
  page: SettingsCategory;
  text: SettingsRowText;
  score: number;
  isNew?: boolean;
};

const WHATS_NEW = 100;
const TITLE = 3;
const OPTION = 2;
const DESCRIPTION = 1;
export const MAX_HITS_PER_PAGE = 5;

const WHATS_NEW_QUERIES = new Set(["new", "whatsnew", "新", "新增", "新功能", "本版新增"]);

export function normalizeSearchText(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function isWhatsNewQuery(query: string) {
  return WHATS_NEW_QUERIES.has(normalizeSearchText(query));
}

export function searchWords(query: string) {
  return query.split(/\s+/).map(normalizeSearchText).filter(Boolean);
}

function wordScore(word: string, entry: SettingsSearchEntry, locales: readonly LocaleCode[]) {
  let best = 0;
  for (const locale of locales) {
    const text = entry[locale];
    if (normalizeSearchText(text.title).includes(word)) return TITLE;
    if (text.options?.some((option) => normalizeSearchText(option).includes(word))) best = Math.max(best, OPTION);
    if (text.description && normalizeSearchText(text.description).includes(word)) best = Math.max(best, DESCRIPTION);
  }
  return best;
}

export function searchSettingsRows(
  query: string,
  entries: readonly SettingsSearchEntry[],
  locale: LocaleCode,
  locales: readonly LocaleCode[],
  pageText: (page: SettingsCategory) => string,
  activeSince?: ReadonlySet<string>,
  activePages?: ReadonlySet<string>,
): SettingsRowHit[] {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const whatsNewSearch = Boolean(activeSince && activeSince.size > 0 && isWhatsNewQuery(query));
  const pages = new Map<SettingsCategory, string>();
  const hits: SettingsRowHit[] = [];
  for (const entry of entries) {
    const isNew = Boolean(entry.since && activeSince?.has(entry.since) && (!activePages || activePages.has(entry.page)));
    if (whatsNewSearch && isNew) {
      hits.push({ page: entry.page, text: entry[locale], score: WHATS_NEW, isNew: true });
      continue;
    }
    let page = pages.get(entry.page);
    if (page === undefined) pages.set(entry.page, (page = normalizeSearchText(pageText(entry.page))));
    let score = 0;
    let inRow = false;
    let all = true;
    for (const word of words) {
      const found = wordScore(word, entry, locales);
      if (found > 0) {
        score += found;
        inRow = true;
      } else if (!page.includes(word)) {
        all = false;
        break;
      }
    }
    if (all && inRow) hits.push({ page: entry.page, text: entry[locale], score, ...(isNew ? { isNew: true } : {}) });
  }
  return hits.sort((a, b) => b.score - a.score);
}

export function isTitleHit(hit: SettingsRowHit | undefined, query: string) {
  return hit !== undefined && hit.score >= searchWords(query).length * TITLE;
}
