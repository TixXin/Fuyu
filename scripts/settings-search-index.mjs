import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPage, withRegressionBrowser } from "./run-regression.mjs";

const LOCALES = ["zh-CN", "en"];
const STATES = ["on", "default"];
const PAGE = "settings-search.html";

export function mergeStates(byState) {
  const key = (row) => `${row.page}\u0000${row.group}\u0000${row.title}`;
  const rows = [];
  const byKey = new Map();
  for (const state of byState) {
    for (const row of state) {
      const existing = byKey.get(key(row));
      if (existing) {
        if (!existing.since && row.since) existing.since = row.since;
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
    const entry = { page: row.page, ...(row.since ? { since: row.since } : {}) };
    for (const locale of LOCALES) {
      const { page, since, ...text } = byLocale[locale][index];
      if (page !== row.page) throw new Error(`Row ${index} is on ${row.page} in ${first} but on ${page} in ${locale}`);
      if ((since ?? null) !== (row.since ?? null)) {
        throw new Error(`Row ${index} (${row.page} / ${row.title}) has since=${row.since ?? "none"} in ${first} but ${since ?? "none"} in ${locale}`);
      }
      entry[locale] = text;
    }
    return entry;
  });
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

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  const entries = pairLocales(byLocale);
  const file = path.join(root, "src/windows/settings/searchIndex.json");
  writeFileSync(file, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
  const whatsNew = buildWhatsNewIndex(entries);
  const whatsNewFile = path.join(root, "src/windows/settings/whatsNewIndex.json");
  writeFileSync(whatsNewFile, `${JSON.stringify({ version: 1, entries: whatsNew }, null, 2)}\n`);
  console.log(`Wrote ${entries.length} settings (${whatsNew.length} tagged with since) to ${path.relative(root, file)} and ${path.relative(root, whatsNewFile)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
