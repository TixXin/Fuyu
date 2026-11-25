import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareVersions } from "./release/channel.mjs";
import { expiredSinceVersions } from "./release/since.mjs";
import { isVersion } from "./release/versions.mjs";
import { runPage, withRegressionBrowser } from "./run-regression.mjs";

const LOCALES = ["zh-CN", "en"];
const STATES = ["on", "default"];
const PAGE = "settings-search.html";
const NEXT_SINCE = "next";
const OFF_SINCE = "off";
const KEEP_BASES = 3;

function normalizeKeyText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function rowTitleKey(page, title) {
  return `${page}\u0000${normalizeKeyText(title)}`;
}

export function mergeStates(byState) {
  const key = (row) => `${row.page}\u0000${row.group}\u0000${row.title}`;
  const rows = [];
  const byKey = new Map();
  for (const state of byState) {
    for (const row of state) {
      const existing = byKey.get(key(row));
      if (existing) {
        if (!existing.since && row.since) existing.since = row.since;
        if (existing.indent && !row.indent) existing.indent = false;
        continue;
      }
      const copy = { ...row };
      byKey.set(key(row), copy);
      rows.push(copy);
    }
  }
  return rows;
}

export function pairLocales(byLocale) {
  const [first, ...others] = LOCALES;
  const count = byLocale[first].length;
  for (const locale of others) {
    if (byLocale[locale].length !== count) throw new Error(`${first} has ${count} rows, ${locale} ${byLocale[locale].length}`);
  }
  return byLocale[first].map((row, index) => {
    const entry = {
      page: row.page,
      ...(row.since ? { since: row.since } : {}),
      ...(row.indent ? { indent: true } : {}),
    };
    for (const locale of LOCALES) {
      const { page, since, indent, ...text } = byLocale[locale][index];
      if (page !== row.page) throw new Error(`Row ${index} is on ${row.page} in ${first} but on ${page} in ${locale}`);
      if ((since ?? null) !== (row.since ?? null)) {
        throw new Error(`Row ${index} (${row.page} / ${row.title}) has since=${row.since ?? "none"} in ${first} but ${since ?? "none"} in ${locale}`);
      }
      if (Boolean(indent) !== Boolean(row.indent)) {
        throw new Error(`Row ${index} (${row.page} / ${row.title}) indent mismatch between ${first} and ${locale}`);
      }
      entry[locale] = text;
    }
    return entry;
  });
}

export function applyAutoSince(
  entries,
  { baseEntries = [], currentEntries = [], currentVersion = "", keepBases = KEEP_BASES } = {},
) {
  const hasBaseline = baseEntries.length > 0;
  const baseZh = new Set();
  const baseEn = new Set();
  for (const entry of baseEntries) {
    if (entry["zh-CN"]?.title) baseZh.add(rowTitleKey(entry.page, entry["zh-CN"].title));
    if (entry.en?.title) baseEn.add(rowTitleKey(entry.page, entry.en.title));
  }

  const carriedVersions = [];
  const carriedZh = new Map();
  const carriedEn = new Map();
  for (const entry of [...baseEntries, ...currentEntries]) {
    if (typeof entry.since !== "string" || !isVersion(entry.since)) continue;
    carriedVersions.push(entry.since);
    if (entry["zh-CN"]?.title) carriedZh.set(rowTitleKey(entry.page, entry["zh-CN"].title), entry.since);
    if (entry.en?.title) carriedEn.set(rowTitleKey(entry.page, entry.en.title), entry.since);
  }
  for (const entry of entries) {
    if (typeof entry.since === "string" && isVersion(entry.since)) carriedVersions.push(entry.since);
  }

  const expired = currentVersion && isVersion(currentVersion)
    ? new Set(expiredSinceVersions(carriedVersions, currentVersion, keepBases))
    : new Set();

  const autoTagged = [];
  const resolved = entries.map((raw) => {
    const { indent, since: explicit, ...rest } = raw;
    if (explicit === OFF_SINCE) return rest;
    if (explicit === NEXT_SINCE) return { ...rest, since: NEXT_SINCE };
    if (typeof explicit === "string" && isVersion(explicit)) {
      return expired.has(explicit) ? rest : { ...rest, since: explicit };
    }
    const zhKey = rowTitleKey(rest.page, rest["zh-CN"]?.title);
    const enKey = rowTitleKey(rest.page, rest.en?.title);
    const inBaseline = baseZh.has(zhKey) || baseEn.has(enKey);
    if (!hasBaseline || inBaseline) {
      const carried = carriedZh.get(zhKey) ?? carriedEn.get(enKey);
      if (carried && !expired.has(carried)) return { ...rest, since: carried };
      return rest;
    }
    if (indent) return rest;
    autoTagged.push(rest);
    return { ...rest, since: NEXT_SINCE };
  });

  return { entries: resolved, autoTagged, expired: [...expired] };
}

export function buildWhatsNewIndex(entries) {
  return entries
    .filter((entry) => typeof entry.since === "string" && entry.since.length > 0)
    .map((entry) => ({
      page: entry.page,
      since: entry.since,
      "zh-CN": { group: entry["zh-CN"].group, title: entry["zh-CN"].title },
      en: { group: entry.en.group, title: entry.en.title },
    }));
}

export function latestReleaseTag(tags) {
  const valid = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith("v") && isVersion(tag.slice(1)))
    .sort((left, right) => compareVersions(left.slice(1), right.slice(1)));
  return valid.at(-1) ?? null;
}

function readJsonEntries(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function loadBaseline(root, indexPath) {
  const currentEntries = existsSync(indexPath) ? readJsonEntries(readFileSync(indexPath, "utf8")) : [];
  let currentVersion = "";
  const pkgPath = path.join(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (typeof pkg.version === "string") currentVersion = pkg.version;
    } catch {}
  }
  try {
    const tags = execFileSync("git", ["tag", "--list", "v*"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .filter(Boolean);
    const tag = latestReleaseTag(tags);
    if (tag) {
      const raw = execFileSync("git", ["show", `${tag}:src/windows/settings/searchIndex.json`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const baseEntries = readJsonEntries(raw);
      if (baseEntries.length > 0) return { tag, baseEntries, currentEntries, currentVersion };
    }
  } catch {}
  return { tag: null, baseEntries: currentEntries, currentEntries, currentVersion };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const skipAuto = process.argv.includes("--no-auto-since");
  const byLocale = await withRegressionBrowser(root, PAGE, async ({ session, base }) => {
    const collected = {};
    for (const locale of LOCALES) {
      const byState = [];
      for (const state of STATES) {
        const { outcome, state: shown, errors } = await runPage(session, `${base}${PAGE}?collect=${locale}&state=${state}${state === "on" ? "&notch" : ""}`);
        if (outcome !== "passed") throw new Error(`${PAGE} (${locale}, ${state}) ${outcome}: ${shown.text ?? ""} ${errors.join(" ")}`);
        const { result } = await session.send("Runtime.evaluate", { expression: "document.documentElement.dataset.index", returnByValue: true });
        byState.push(JSON.parse(result.value));
      }
      collected[locale] = mergeStates(byState);
    }
    return collected;
  });
  const file = path.join(root, "src/windows/settings/searchIndex.json");
  const paired = pairLocales(byLocale);
  const baseline = loadBaseline(root, file);
  const { entries, autoTagged, expired } = skipAuto
    ? { entries: paired.map(({ indent: _, ...rest }) => rest), autoTagged: [], expired: [] }
    : applyAutoSince(paired, baseline);
  writeFileSync(file, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
  const whatsNew = buildWhatsNewIndex(entries);
  const whatsNewFile = path.join(root, "src/windows/settings/whatsNewIndex.json");
  writeFileSync(whatsNewFile, `${JSON.stringify({ version: 1, entries: whatsNew }, null, 2)}\n`);
  console.log(`Wrote ${entries.length} settings (${whatsNew.length} tagged with since) to ${path.relative(root, file)} and ${path.relative(root, whatsNewFile)}.`);
  if (autoTagged.length > 0) {
    console.log(`Auto-tagged ${autoTagged.length} new setting(s) as next (baseline: ${baseline.tag ?? "local"}):`);
    for (const entry of autoTagged) {
      console.log(`  + [${entry.page}] ${entry["zh-CN"].group ? `${entry["zh-CN"].group} › ` : ""}${entry["zh-CN"].title}`);
    }
  }
  if (expired.length > 0) {
    console.log(`Pruned expired since version(s): ${expired.join(", ")}`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
