import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openIndex } from "../../../../packages/plugin-market/src/index.mjs";
import { PACKAGES_SUBDIR, writeInstalledToYml } from "../../../../packages/plugin-cli/src/installer.mjs";
import { INDEX_FILE, INDEX_SIG_FILE, isObject, readInstalledPackages, readYmlEntries } from "./marketStore.mjs";

export function normalizeRepository(raw) {
  const value = typeof raw === "string" ? raw : isObject(raw) && typeof raw.url === "string" ? raw.url : "";
  const cleaned = value.trim().replace(/^git\+/, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  return cleaned ? cleaned.toLowerCase() : null;
}

export function readSignedCachedIndex(dataDir, trust, now) {
  const indexPath = join(dataDir, INDEX_FILE);
  const sigPath = join(dataDir, INDEX_SIG_FILE);
  if (!existsSync(indexPath) || !existsSync(sigPath)) return null;
  try {
    const text = readFileSync(indexPath, "utf8");
    const signature = JSON.parse(readFileSync(sigPath, "utf8"));
    const opened = openIndex({ text, signature, trust, now });
    return opened.status === "ok" || opened.status === "expired" ? opened.doc : null;
  } catch {
    return null;
  }
}

function readInstalledRepository(pluginsDir, id) {
  if (typeof id !== "string" || !id.startsWith("@")) return null;
  const parts = id.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const pkgPath = join(pluginsDir, PACKAGES_SUBDIR, parts[0].toLowerCase(), parts[1], "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return normalizeRepository(pkg?.repository);
  } catch {
    return null;
  }
}

export function reconcileOfficialMarketFlags({ pluginsDir, doc, trustedAuthors = {} }) {
  if (!doc || !Array.isArray(doc.plugins)) return [];
  const ymlFile = join(pluginsDir, "plugins.yml");
  const ymlEntries = readYmlEntries(ymlFile);
  const installed = readInstalledPackages(pluginsDir);
  const byName = new Map(doc.plugins.map((plugin) => [plugin.name, plugin]));
  const migrated = [];

  for (const inst of installed) {
    if (inst.source !== "market" || inst.official === true) continue;
    if (ymlEntries.get(inst.id)?.source !== "market") continue;
    const pluginEntry = byName.get(inst.id);
    if (pluginEntry?.publisher?.official !== true) continue;
    const versionEntry = (pluginEntry.versions ?? []).find((entry) => entry.version === inst.version);
    const expectedRepo = normalizeRepository(versionEntry?.repository);
    if (!expectedRepo) continue;
    const pin = isObject(trustedAuthors) ? trustedAuthors[inst.id] : null;
    if (isObject(pin)) {
      if (pin.keyId != null || normalizeRepository(pin.repository) !== expectedRepo) continue;
    }
    if (readInstalledRepository(pluginsDir, inst.id) !== expectedRepo) continue;
    writeInstalledToYml(ymlFile, {
      id: inst.id,
      source: "market",
      official: true,
      disabled: !inst.enabled,
      replaces: inst.replaces,
    });
    migrated.push(inst.id);
  }

  return migrated;
}
