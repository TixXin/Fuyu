import { compareVersions } from "./channel.mjs";

const SECTIONS = {
  zh: { start: "## 更新内容", end: /^---\s*$|^## /, fixes: /^- \*\*修复\*\*[：:]\s*$/ },
  en: { start: "## What's New", end: /^## /, fixes: /^- \*\*Fixes\*\*:?\s*$/ },
};

export function betaTags(version, tags) {
  const prefix = `v${version}-beta.`;
  return tags
    .filter((tag) => tag.startsWith(prefix) && /^\d+$/.test(tag.slice(prefix.length)))
    .sort((left, right) => compareVersions(right.slice(1), left.slice(1)));
}

export function sectionItems(text, lang) {
  const { start, end } = SECTIONS[lang];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const from = lines.findIndex((line) => line.trim() === start);
  if (from < 0) return [];
  const items = [];
  for (const line of lines.slice(from + 1)) {
    if (end.test(line)) break;
    if (/^- /.test(line)) items.push([line]);
    else if (items.length && line.trim()) items.at(-1).push(line);
  }
  return items.map((item) => item.join("\n")).filter((item) => item.trim() !== "-");
}

export function mergeBetaNotes(texts) {
  const merged = {};
  for (const lang of Object.keys(SECTIONS)) {
    const { fixes } = SECTIONS[lang];
    const features = [];
    const fixLines = [];
    let fixHeading = null;
    for (const text of texts) {
      for (const item of sectionItems(text, lang)) {
        const [first, ...rest] = item.split("\n");
        if (fixes.test(first)) {
          fixHeading ??= first;
          fixLines.push(...rest);
        } else {
          features.push(item);
        }
      }
    }
    const all = fixHeading ? [...features, [fixHeading, ...fixLines].join("\n")] : features;
    merged[lang] = all.join("\n");
  }
  return merged.zh || merged.en ? merged : null;
}
