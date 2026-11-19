import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readSources, slotTitles } from "./lint/source.mjs";

const DESCRIPTION_UNITS = 58;
const NARROW = 0.46;
const LOCALES = ["zh-CN", "en"];
const WIDE = /[\u1100-\u115f\u2e80-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;
const HOW = [
  /基于/,
  /API\s*Key/i,
  /(?:免|无需|不用)\s*(?:注册|登录|密钥)/,
  /在设置(?:中|里|页)?\s*(?:配置|填写|填入)/,
  /owner\/repo/i,
  /原生接口/,
  /\bbased on\b/i,
  /\bpowered by\b/i,
  /\bbuilt (?:with|on|using)\b/i,
  /\bno (?:sign-?up|registration|key) (?:needed|required)\b/i,
  /\bconfigure\b[^.;]*\bin (?:the )?settings\b/i,
];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim() !== "";

function textUnits(text) {
  let units = 0;
  for (const char of text) units += WIDE.test(char) ? 1 : NARROW;
  return units;
}

function screenshots({ app, appKey }) {
  if (Array.isArray(app.screenshots) && app.screenshots.length > 0) return [];
  return [
    {
      path: `${appKey}.screenshots`,
      code: "listing:screenshots",
      message: `no screenshots: list at least one in ${appKey}.screenshots (a plugin without its own interface shows the place where it takes effect)`,
    },
  ];
}

function description({ manifest, app, appKey }) {
  const issues = [];
  if (!isObject(app.description)) return issues;
  for (const locale of LOCALES) {
    const text = app.description[locale];
    if (!isText(text)) continue;
    const path = `${appKey}.description.${locale}`;
    const units = textUnits(text.trim());
    if (units > DESCRIPTION_UNITS) {
      issues.push({
        path,
        code: "listing:description-length",
        message: `the description is about ${Math.ceil(units)} characters wide and the market card shows two lines, about ${DESCRIPTION_UNITS} (a Latin letter counts as about half); the rest is cut off`,
      });
    }
    const how = HOW.map((pattern) => pattern.exec(text)).find(Boolean);
    if (how) {
      issues.push({ path, code: "listing:description-how", message: `the description says how the plugin is built or set up ("${how[0]}"); say what it does for the user and leave the rest to the README` });
    }
  }
  if (isText(app.description.en) && typeof manifest.description === "string" && manifest.description.trim() !== app.description.en.trim()) {
    issues.push({ path: "description", code: "listing:description-mismatch", message: `the top-level description differs from ${appKey}.description.en; npm and the market would describe the plugin differently` });
  }
  return issues;
}

function heading(file) {
  return /^#\s+(.+?)\s*#*\s*$/m.exec(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))?.[1] ?? null;
}

function readmes({ dir, app, appKey }) {
  if (!isObject(app.displayName)) return [];
  let files;
  try {
    files = readdirSync(dir).filter((name) => /^readme(?:\.[A-Za-z-]+)?\.md$/i.test(name));
  } catch {
    return [];
  }
  if (!files.some((name) => name.toLowerCase() === "readme.md")) {
    return [{ path: "README.md", code: "listing:readme", message: "no README.md: the plugin's detail page on the market shows it" }];
  }
  const names = LOCALES.map((locale) => app.displayName[locale]).filter(isText);
  const issues = [];
  for (const name of files.sort()) {
    const title = heading(join(dir, name));
    const locale = /^readme\.([A-Za-z-]+)\.md$/i.exec(name)?.[1];
    const wanted = locale && isText(app.displayName[locale]) ? [app.displayName[locale]] : names;
    if (title === null || wanted.some((item) => title.toLowerCase().includes(item.trim().toLowerCase()))) continue;
    issues.push({ file: name, code: "listing:name-readme", message: `the title "${title}" does not contain the plugin's name (${appKey}.displayName: ${wanted.map((item) => `"${item}"`).join(" or ")})` });
  }
  return issues;
}

function pageTitles({ dir, app, appKey }) {
  if (!isObject(app.displayName) || !existsSync(join(dir, "src"))) return [];
  const issues = [];
  const seen = new Set();
  for (const title of slotTitles(readSources(dir), "island.page/v1")) {
    for (const locale of LOCALES) {
      const name = app.displayName[locale];
      const shown = title[locale];
      if (!isText(name) || !isText(shown) || shown.trim() === name.trim() || seen.has(`${locale}:${shown}`)) continue;
      seen.add(`${locale}:${shown}`);
      issues.push({ path: `${appKey}.displayName.${locale}`, code: "listing:name-page", message: `the island page is titled "${shown}" (${locale}) and the plugin is named "${name}"; use one name everywhere` });
    }
  }
  return issues;
}

const RULES = [screenshots, description, readmes, pageTitles];

export function lintListing(dir, manifest, options = {}) {
  const appKey = options.appKey ?? "fuyu";
  const app = manifest?.[appKey];
  if (!isObject(app)) return [];
  return RULES.flatMap((rule) => rule({ dir, manifest, app, appKey }));
}
