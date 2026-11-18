import type { EntryTuple, FormTuple, LemmaMatch } from "./types.ts";

const KIND_LABELS: Readonly<Record<string, readonly [zh: string, en: string]>> = {
  p: ["过去式", "past tense"],
  d: ["过去分词", "past participle"],
  i: ["现在分词", "present participle"],
  "3": ["第三人称单数", "3rd-person singular"],
  s: ["复数", "plural"],
  r: ["比较级", "comparative"],
  t: ["最高级", "superlative"],
  pos: ["所有格", "possessive"],
  f: ["词形变化", "inflected form"],
};

export function describeInflection(kind: string): string {
  if (Object.hasOwn(KIND_LABELS, kind)) {
    const [zh, en] = KIND_LABELS[kind];
    return `${zh} / ${en}`;
  }
  const zhParts: string[] = [];
  const enParts: string[] = [];
  for (const ch of kind) {
    if (Object.hasOwn(KIND_LABELS, ch)) {
      const [zh, en] = KIND_LABELS[ch];
      if (!zhParts.includes(zh)) zhParts.push(zh);
      if (!enParts.includes(en)) enParts.push(en);
    }
  }
  if (zhParts.length > 0) {
    return `${zhParts.join("、")} / ${enParts.join(" & ")}`;
  }
  return "词形变化 / inflected form";
}

function hasEntry(entries: Readonly<Record<string, EntryTuple>>, word: string): boolean {
  return Object.hasOwn(entries, word);
}

function undoubledStem(stem: string): string | null {
  if (stem.length < 3) return null;
  const last = stem[stem.length - 1];
  const prev = stem[stem.length - 2];
  if (last === prev && /^[b-df-hj-np-tv-z]$/.test(last)) {
    return stem.slice(0, -1);
  }
  return null;
}

function singleWordCandidates(word: string): LemmaMatch[] {
  const out: LemmaMatch[] = [];
  const push = (lemma: string, kind: string) => {
    if (lemma && lemma !== word && !out.some((item) => item.lemma === lemma)) {
      out.push({ lemma, kind });
    }
  };

  if (word.endsWith("'s") && word.length > 3) {
    push(word.slice(0, -2), "pos");
  } else if (word.endsWith("s'") && word.length > 3) {
    push(word.slice(0, -1), "pos");
    push(word.slice(0, -2), "pos");
  }

  if (word.endsWith("ies") && word.length > 4) {
    push(`${word.slice(0, -3)}y`, "3s");
  }
  if (word.endsWith("ves") && word.length > 4) {
    const stem = word.slice(0, -3);
    push(`${stem}f`, "s");
    push(`${stem}fe`, "s");
  }
  if (word.endsWith("es") && word.length > 3) {
    if (/(?:sh|ch|x|z|ss|o)es$/.test(word)) {
      push(word.slice(0, -2), "3s");
    }
    push(word.slice(0, -1), "3s");
    push(word.slice(0, -2), "3s");
  }
  if (word.endsWith("s") && word.length > 2 && !/(?:ss|us|is)$/.test(word)) {
    push(word.slice(0, -1), "3s");
  }

  if (word.endsWith("ied") && word.length > 4) {
    push(`${word.slice(0, -3)}y`, "pd");
  }
  if (word.endsWith("ed") && word.length > 3) {
    const stem = word.slice(0, -2);
    push(stem, "pd");
    push(word.slice(0, -1), "pd");
    const single = undoubledStem(stem);
    if (single) push(single, "pd");
  }

  if (word.endsWith("ying") && word.length > 4) {
    push(`${word.slice(0, -4)}ie`, "i");
  }
  if (word.endsWith("ing") && word.length > 4) {
    const stem = word.slice(0, -3);
    const single = undoubledStem(stem);
    if (single) push(single, "i");
    push(stem, "i");
    push(`${stem}e`, "i");
  }

  if (word.endsWith("iest") && word.length > 5) {
    push(`${word.slice(0, -4)}y`, "t");
  }
  if (word.endsWith("est") && word.length > 4) {
    const stem = word.slice(0, -3);
    const single = undoubledStem(stem);
    if (single) push(single, "t");
    push(stem, "t");
    push(word.slice(0, -2), "t");
  }

  if (word.endsWith("ier") && word.length > 4) {
    push(`${word.slice(0, -3)}y`, "r");
  }
  if (word.endsWith("er") && word.length > 3) {
    const stem = word.slice(0, -2);
    const single = undoubledStem(stem);
    if (single) push(single, "r");
    push(stem, "r");
    push(word.slice(0, -1), "r");
  }

  return out;
}

export function lemmatizeEnglish(
  query: string,
  entries: Readonly<Record<string, EntryTuple>>,
  forms: Readonly<Record<string, FormTuple>>,
): LemmaMatch | null {
  if (Object.hasOwn(forms, query)) {
    const [lemma, kind] = forms[query];
    if (lemma !== query && hasEntry(entries, lemma)) {
      return { lemma, kind };
    }
  }

  if (!query.includes(" ")) {
    for (const candidate of singleWordCandidates(query)) {
      if (hasEntry(entries, candidate.lemma)) {
        return candidate;
      }
    }
    return null;
  }

  const parts = query.split(" ");
  if (parts.length < 2 || parts.length > 4) return null;
  const [first, ...rest] = parts;
  const tail = rest.join(" ");

  if (Object.hasOwn(forms, first)) {
    const [firstBase, kind] = forms[first];
    const phrase = `${firstBase} ${tail}`;
    if (hasEntry(entries, phrase)) {
      return { lemma: phrase, kind };
    }
  }
  for (const candidate of singleWordCandidates(first)) {
    const phrase = `${candidate.lemma} ${tail}`;
    if (hasEntry(entries, phrase)) {
      return { lemma: phrase, kind: candidate.kind };
    }
  }
  return null;
}
