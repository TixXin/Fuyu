import { compareVersions } from "./channel.mjs";

const NOTES_FILE = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.md$/;
const FIX_TITLES = new Set(["修复", "Fixes"]);
const PLATFORM = /^[（(](Mac|Windows)[）)]\s*/;

export function latestNotesVersion(fileNames) {
  const versions = fileNames.map((name) => name.match(NOTES_FILE)?.[1]).filter(Boolean);
  return versions.sort(compareVersions).at(-1) ?? null;
}

function between(text, start, end) {
  const from = text.indexOf(start);
  if (from < 0) return "";
  const rest = text.slice(from + start.length);
  const stop = rest.search(end);
  return stop < 0 ? rest : rest.slice(0, stop);
}

function plain(text) {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`/g, "").replace(/\*\*/g, "").trim();
}

function parseItem(raw) {
  let rest = raw.trim();
  let platform = rest.match(PLATFORM)?.[1] ?? null;
  rest = rest.replace(PLATFORM, "");
  const bold = rest.match(/^\*\*(.+?)\*\*\s*[：:]?\s*/);
  if (!bold) return { title: plain(rest), desc: "", platform };
  let title = bold[1].replace(/[：:]$/, "");
  const inner = title.match(PLATFORM);
  if (inner) {
    platform ??= inner[1];
    title = title.replace(PLATFORM, "");
  }
  return { title: plain(title), desc: plain(rest.slice(bold[0].length)), platform };
}

function parseSections(text) {
  const sections = [];
  let section = null;
  let item = null;
  for (const line of text.split("\n")) {
    const heading = line.match(/^###\s+(.+)/);
    if (heading) {
      section = { title: plain(heading[1]), items: [] };
      sections.push(section);
      item = null;
      continue;
    }
    const top = line.match(/^- (.+)/);
    if (top) {
      if (!section) {
        section = { title: "", items: [] };
        sections.push(section);
      }
      item = { ...parseItem(top[1]), children: [] };
      section.items.push(item);
      continue;
    }
    const nested = line.match(/^\s+- (.+)/);
    if (nested && item) item.children.push(parseItem(nested[1]));
  }
  return sections;
}

function splitFixes(sections) {
  const result = [];
  const fixes = [];
  for (const section of sections) {
    if (FIX_TITLES.has(section.title)) {
      fixes.push(...section.items);
      continue;
    }
    const kept = [];
    for (const item of section.items) {
      if (FIX_TITLES.has(item.title) && item.children.length) fixes.push(...item.children);
      else kept.push(item);
    }
    if (kept.length) result.push({ title: section.title, fix: false, items: kept });
  }
  const strip = ({ title, desc, platform }) => ({ title, desc, platform });
  const out = result.map((section) => ({ ...section, items: section.items.map(strip) }));
  if (fixes.length) out.push({ title: "", fix: true, items: fixes.map(strip) });
  return out;
}

export function parseReleaseNotes(markdown) {
  const text = markdown.replace(/\r/g, "");
  return {
    zh: splitFixes(parseSections(between(text, "## 更新内容", /\n---\n|\n## /))),
    en: splitFixes(parseSections(between(text, "## What's New", /\n## /))),
  };
}
