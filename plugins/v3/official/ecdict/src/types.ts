export type Direction = "auto" | "zh-en" | "en-zh";

export type EntryTuple = readonly [phonetic: string, translation: string];

export type FormTuple = readonly [lemma: string, kind: string];

export interface EcdictData {
  readonly entries: Readonly<Record<string, EntryTuple>>;
  readonly forms: Readonly<Record<string, FormTuple>>;
}

export interface LemmaMatch {
  readonly lemma: string;
  readonly kind: string;
}
