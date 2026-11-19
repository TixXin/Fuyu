export type PinyinOf = (text: string) => { full: string; initials: string };

let pinyinOf: PinyinOf | null = null;
let loading: Promise<PinyinOf | null> | null = null;

export function isPinyinLoaded(): boolean {
  return pinyinOf !== null;
}

export function loadedPinyin(): PinyinOf | null {
  return pinyinOf;
}

export function loadPinyin(): Promise<PinyinOf | null> {
  loading ??= import("pinyin-pro")
    .then(({ pinyin }) => {
      const options = { toneType: "none", type: "array", nonZh: "removed", v: true } as const;
      pinyinOf = (text) => ({
        full: pinyin(text, options).join("").toLowerCase(),
        initials: pinyin(text, { ...options, pattern: "first" }).join("").toLowerCase(),
      });
      return pinyinOf;
    })
    .catch(() => null);
  return loading;
}
