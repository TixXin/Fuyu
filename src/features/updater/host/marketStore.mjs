import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptyRevocations,
  openIndex,
  revocationOf,
  selectVersions,
} from "../../../../packages/plugin-market/src/index.mjs";
import { PACKAGES_SUBDIR } from "../../../../packages/plugin-cli/src/installer.mjs";

export const STATE_FILE = "market-state.json";
export const INDEX_FILE = "index.v3.json";
export const INDEX_SIG_FILE = "index.v3.json.sig";

export const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
export const toTimestamp = (now) => (now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.now());

export function marketError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function parseAppVersionFromArgv(argv = process.argv) {
  if (Array.isArray(argv)) {
    for (let i = 0; i < argv.length; i += 1) {
      const arg = String(argv[i] ?? "");
      if (arg === "--app-version" && typeof argv[i + 1] === "string" && argv[i + 1].trim()) {
        return argv[i + 1].trim();
      }
      if (arg.startsWith("--app-version=")) {
        const val = arg.slice("--app-version=".length).trim();
        if (val) return val;
      }
    }
  }
  return "0.3.11";
}

function unquoteYamlScalar(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (text.startsWith("\"") && text.endsWith("\"")) {
    try {
      return String(JSON.parse(text));
    } catch {
      return text.slice(1, -1);
    }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
  return text;
}

export function readYmlEntries(ymlFile) {
  const entries = new Map();
  if (!existsSync(ymlFile)) return entries;
  const lines = readFileSync(ymlFile, "utf8").replace(/\r\n/g, "\n").split("\n");
  let current = null;
  let inReplaces = false;
  for (const line of lines) {
    if (line.startsWith("- ")) {
      const idMatch = /^-\s+id:\s*(.+)$/.exec(line.trim());
      current = idMatch ? { id: unquoteYamlScalar(idMatch[1]), source: "market", disabled: false, replaces: [] } : null;
      inReplaces = false;
      if (current?.id) entries.set(current.id, current);
      continue;
    }
    if (!current) continue;
    if (/^\s{2}replaces:\s*$/.test(line)) {
      inReplaces = true;
      continue;
    }
    if (inReplaces) {
      const itemMatch = /^\s{4}-\s*(.+)$/.exec(line);
      if (itemMatch) {
        current.replaces.push(unquoteYamlScalar(itemMatch[1]));
        continue;
      }
      if (/^\s{2}[a-zA-Z]/.test(line)) inReplaces = false;
    }
    const sourceMatch = /^\s{2}source:\s*(.+)$/.exec(line);
    if (sourceMatch) {
      const src = unquoteYamlScalar(sourceMatch[1]);
      current.source = src === "manual" ? "manual" : "market";
      continue;
    }
    const disabledMatch = /^\s{2}disabled:\s*(true|false)\s*$/.exec(line);
    if (disabledMatch) current.disabled = disabledMatch[1] === "true";
  }
  return entries;
}

export function readInstalledPackages(pluginsDir) {
  const ymlMap = readYmlEntries(join(pluginsDir, "plugins.yml"));
  const packagesRoot = join(pluginsDir, PACKAGES_SUBDIR);
  if (!existsSync(packagesRoot)) return [];
  const list = [];
  for (const scopeEntry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!scopeEntry.isDirectory() || !scopeEntry.name.startsWith("@")) continue;
    const scopeDir = join(packagesRoot, scopeEntry.name);
    for (const pkgEntry of readdirSync(scopeDir, { withFileTypes: true })) {
      if (!pkgEntry.isDirectory()) continue;
      const pkgFile = join(scopeDir, pkgEntry.name, "package.json");
      if (!existsSync(pkgFile)) continue;
      try {
        const parsed = JSON.parse(readFileSync(pkgFile, "utf8"));
        if (typeof parsed.name !== "string" || typeof parsed.version !== "string") continue;
        const yml = ymlMap.get(parsed.name);
        const fuyu = isObject(parsed.fuyu) ? parsed.fuyu : {};
        list.push({
          id: parsed.name,
          version: parsed.version,
          source: yml?.source === "manual" ? "manual" : "market",
          enabled: yml ? !yml.disabled : false,
          displayName: fuyu.displayName,
          description: fuyu.description,
          replaces: yml?.replaces?.length ? yml.replaces : Array.isArray(fuyu.replaces) ? fuyu.replaces : [],
        });
      } catch {
        continue;
      }
    }
  }
  list.sort((a, b) => a.id.localeCompare(b.id));
  return list;
}

export function confirmationFromManifest(manifest, { unreviewed, official }) {
  const m = isObject(manifest) ? manifest : {};
  return {
    unreviewed: Boolean(unreviewed),
    official: Boolean(official),
    displayName: m.displayName,
    description: m.description,
    network: Array.isArray(m.network) ? [...m.network] : [],
    nodeApis: Array.isArray(m.nodeApis) ? [...m.nodeApis] : [],
    provides: Array.isArray(m.provides) ? [...m.provides] : [],
    replaces: Array.isArray(m.replaces) ? [...m.replaces] : [],
    slots: Array.isArray(m.slots) ? [...m.slots] : [],
  };
}

export function candidateView(item, official, extra = {}) {
  if (!item?.entry) return null;
  const entry = item.entry;
  return {
    version: entry.version,
    sha256: entry.sha256,
    size: entry.size,
    publishedAt: entry.publishedAt,
    ...extra,
    confirmation: confirmationFromManifest(entry.manifest, { unreviewed: false, official }),
  };
}

export function decodeBase64(base64) {
  if (typeof base64 !== "string" || !base64.trim()) {
    throw marketError("bad-params", "base64 package bytes are required");
  }
  const body = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1).trim() : base64.trim();
  const buf = Buffer.from(body, "base64");
  if (buf.length === 0) throw marketError("bad-params", "decoded package is empty");
  return buf;
}

export function readState(dataDir) {
  const statePath = join(dataDir, STATE_FILE);
  if (!existsSync(statePath)) {
    return { manualAllowed: false, lastIndexSerial: null, revocations: emptyRevocations(), updatedAt: null, lastError: null };
  }
  try {
    const raw = JSON.parse(readFileSync(statePath, "utf8"));
    return {
      manualAllowed: raw?.manualAllowed === true,
      lastIndexSerial: Number.isSafeInteger(raw?.lastIndexSerial) ? raw.lastIndexSerial : null,
      revocations: isObject(raw?.revocations) && Array.isArray(raw.revocations.entries) ? raw.revocations : emptyRevocations(),
      updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : null,
      lastError: typeof raw?.lastError === "string" ? raw.lastError : null,
    };
  } catch {
    return { manualAllowed: false, lastIndexSerial: null, revocations: emptyRevocations(), updatedAt: null, lastError: null };
  }
}

export function writeState(dataDir, state) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function readVerifiedCachedIndex(dataDir, trust, now) {
  const indexPath = join(dataDir, INDEX_FILE);
  const sigPath = join(dataDir, INDEX_SIG_FILE);
  if (!existsSync(indexPath) || !existsSync(sigPath)) return { doc: null, error: null };
  try {
    const text = readFileSync(indexPath, "utf8");
    const signature = JSON.parse(readFileSync(sigPath, "utf8"));
    const opened = openIndex({ text, signature, trust, now });
    if (opened.status !== "ok") return { doc: null, error: opened.reason ?? opened.status };
    return { doc: opened.doc, error: null };
  } catch (error) {
    return { doc: null, error: String(error?.message ?? error) };
  }
}

export function buildMarketSnapshot({ dataDir, pluginsDir, appVersion, platform, trust, now }) {
  const state = readState(dataDir);
  const installedRaw = readInstalledPackages(pluginsDir);
  const installedById = new Map(installedRaw.map((item) => [item.id, item]));
  const { doc, error: indexError } = readVerifiedCachedIndex(dataDir, trust, now);
  const plugins = (doc?.plugins ?? []).map((plugin) => {
    const inst = installedById.get(plugin.name) ?? null;
    const official = plugin.publisher?.official === true;
    const selected = selectVersions(plugin, {
      fuyuVersion: appVersion,
      platform,
      now,
      installed: inst?.version ?? null,
      revocations: state.revocations,
    });
    const primaryEntry = selected.install?.entry ?? selected.manual?.entry ?? plugin.versions?.[0];
    const manifest = isObject(primaryEntry?.manifest) ? primaryEntry.manifest : {};
    const instRevoked = inst ? revocationOf(state.revocations, plugin.name, inst.version)?.level === "disable" : false;
    const allRevoked =
      !inst &&
      Array.isArray(plugin.versions) &&
      plugin.versions.length > 0 &&
      selected.skipped.length === plugin.versions.length &&
      selected.skipped.some((item) => item.reason === "revoked");
    return {
      name: plugin.name,
      official,
      publisher: { github: String(plugin.publisher?.github ?? ""), official },
      displayName: isObject(manifest.displayName) ? manifest.displayName : { "zh-CN": plugin.name, en: plugin.name },
      description: isObject(manifest.description) ? manifest.description : { "zh-CN": "", en: "" },
      categories: Array.isArray(manifest.categories) ? [...manifest.categories] : [],
      installedVersion: inst?.version ?? null,
      enabled: inst ? inst.enabled : false,
      source: inst?.source ?? null,
      revoked: Boolean(instRevoked || allRevoked),
      install: candidateView(selected.install, official, selected.install ? { fresh: selected.install.fresh } : {}),
      manual: candidateView(
        selected.manual,
        official,
        selected.manual ? { cooled: selected.manual.cooled, fresh: !selected.manual.cooled, warned: selected.manual.warned } : {},
      ),
      autoUpdate: candidateView(selected.autoUpdate, official, selected.autoUpdate ? { urgent: selected.autoUpdate.urgent } : {}),
    };
  });
  const installed = installedRaw.map(({ id, version, source, enabled, displayName, description }) => ({
    id,
    version,
    source,
    enabled,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(description !== undefined ? { description } : {}),
  }));
  return {
    plugins,
    installed,
    updatedAt: state.updatedAt,
    manualAllowed: state.manualAllowed === true,
    error: indexError ?? state.lastError ?? null,
  };
}
