import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compareVersions,
  openIndex,
  revocationOf,
  satisfies,
  selectVersions,
  verifyEndorsement,
  verifyVersionSignature,
} from "../../../../packages/plugin-market/src/index.mjs";
import { PACKAGES_SUBDIR } from "../../../../packages/plugin-cli/src/installer.mjs";
import { newCapabilities, capabilitiesOf } from "./marketCapabilities.mjs";
import { firstPublishedAt, marketSince, packageIcon, packageReach, pluginIcon, pluginScreenshots } from "./marketListing.mjs";
import { readState } from "./marketState.mjs";

export { STATE_FILE, normalizeTrustedAuthors, readState, writeState } from "./marketState.mjs";

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
      if (arg === "--app-version" && typeof argv[i + 1] === "string" && argv[i + 1].trim()) return argv[i + 1].trim();
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
  return text.startsWith("'") && text.endsWith("'") ? text.slice(1, -1) : text;
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
      current = idMatch ? { id: unquoteYamlScalar(idMatch[1]), source: null, name: null, disabled: false, replaces: [] } : null;
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
      const source = unquoteYamlScalar(sourceMatch[1]);
      current.source = source === "manual" || source === "dev" ? source : "market";
      continue;
    }
    const nameMatch = /^\s{2}name:\s*(.+)$/.exec(line);
    if (nameMatch) {
      current.name = unquoteYamlScalar(nameMatch[1]);
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
          icon: packageIcon(fuyu.icon),
          reach: packageReach(fuyu),
          replaces: yml?.replaces?.length ? yml.replaces : Array.isArray(fuyu.replaces) ? fuyu.replaces : [],
          capabilities: capabilitiesOf(fuyu),
        });
      } catch {
        continue;
      }
    }
  }
  list.sort((a, b) => a.id.localeCompare(b.id));
  return list;
}

export function isKeyEndorsedBy(pluginName, newKeyId, authorKeys, oldKeyId) {
  if (!newKeyId || !oldKeyId || !Array.isArray(authorKeys)) return false;
  const seen = new Set();
  let current = authorKeys.find((item) => item?.keyId === newKeyId);
  while (current && !seen.has(current.keyId)) {
    seen.add(current.keyId);
    const signerId = verifyEndorsement(pluginName, current, authorKeys);
    if (!signerId) return false;
    if (signerId === oldKeyId) return true;
    current = authorKeys.find((item) => item?.keyId === signerId);
  }
  return false;
}

export function resolvePinnedAuthor(plugin, installedVersion, trustedAuthors) {
  const saved = isObject(trustedAuthors) ? trustedAuthors[plugin?.name] : null;
  if (isObject(saved) && typeof saved.repository === "string" && saved.repository) {
    return { keyId: typeof saved.keyId === "string" && saved.keyId ? saved.keyId : null, repository: saved.repository };
  }
  if (!installedVersion) return null;
  const entry = plugin?.versions?.find((item) => item.version === installedVersion) ?? null;
  if (!entry || typeof entry.repository !== "string") return null;
  return { keyId: typeof entry.authorSignature?.keyId === "string" ? entry.authorSignature.keyId : null, repository: entry.repository };
}

export function detectTrustChange(plugin, entry, pin) {
  if (!pin || !entry) return null;
  if (typeof pin.repository === "string" && pin.repository && entry.repository !== pin.repository) return "repo-changed";
  if (plugin?.publisher?.official === true) return null;
  const signedKeyId = verifyVersionSignature(plugin, entry);
  if (!signedKeyId || !pin.keyId) return "unendorsed-key";
  if (signedKeyId === pin.keyId) return null;
  return isKeyEndorsedBy(plugin.name, signedKeyId, plugin.authorKeys ?? [], pin.keyId) ? "endorsed-key" : "unendorsed-key";
}

export function selectCompatibleDependency(plugin, range, { appVersion, platform, now, revocations }) {
  const matching = (plugin?.versions ?? []).filter((item) => satisfies(item.version, range));
  if (matching.length === 0) return null;
  const selected = selectVersions({ ...plugin, versions: matching }, { fuyuVersion: appVersion, platform, now, revocations });
  return selected.install?.entry ?? selected.manual?.entry ?? null;
}

export function planRequiredDependencies({ doc, rootName, rootEntry, installedById, appVersion, platform, now, revocations, strict = false }) {
  const visited = new Set([rootName]);
  const plan = [];
  const visit = (parentName, entry) => {
    const reqs = isObject(entry?.manifest?.requires) ? entry.manifest.requires : null;
    if (!reqs) return;
    for (const [depName, range] of Object.entries(reqs)) {
      if (typeof range !== "string" || !range || visited.has(depName)) continue;
      const inst = installedById.get(depName);
      if (inst && satisfies(inst.version, range) && revocationOf(revocations, depName, inst.version)?.level !== "disable") continue;
      visited.add(depName);
      const depPlugin = doc?.plugins?.find((item) => item.name === depName) ?? null;
      const depEntry = depPlugin ? selectCompatibleDependency(depPlugin, range, { appVersion, platform, now, revocations }) : null;
      if (!depPlugin || !depEntry) {
        if (strict) {
          throw marketError("missing-dependency", `Plugin ${parentName} requires ${depName}@${range}, which is unavailable`, {
            plugin: parentName,
            dependency: depName,
            range,
          });
        }
        plan.push({ name: depName, plugin: null, entry: null });
        continue;
      }
      visit(depName, depEntry);
      plan.push({ name: depName, plugin: depPlugin, entry: depEntry });
    }
  };
  visit(rootName, rootEntry);
  return plan;
}

export function confirmationFromManifest(manifest, { unreviewed, official, trustChange = null, requiredPlugins = null }) {
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
    ...(trustChange ? { trustChange } : {}),
    ...(Array.isArray(requiredPlugins) && requiredPlugins.length > 0 ? { requiredPlugins: [...requiredPlugins] } : {}),
  };
}

export function candidateView(item, official, extra = {}, confirmExtra = {}) {
  if (!item?.entry) return null;
  const entry = item.entry;
  return {
    version: entry.version,
    sha256: entry.sha256,
    size: entry.size,
    publishedAt: entry.publishedAt,
    ...extra,
    ...(confirmExtra.trustChange ? { trustChange: confirmExtra.trustChange } : {}),
    ...(confirmExtra.newCapabilities ? { newCapabilities: confirmExtra.newCapabilities } : {}),
    confirmation: confirmationFromManifest(entry.manifest, {
      unreviewed: false,
      official,
      trustChange: confirmExtra.trustChange ?? null,
      requiredPlugins: confirmExtra.requiredPlugins ?? null,
    }),
  };
}

export function decodeBase64(base64) {
  if (typeof base64 !== "string" || !base64.trim()) throw marketError("bad-params", "base64 package bytes are required");
  const body = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1).trim() : base64.trim();
  const buf = Buffer.from(body, "base64");
  if (buf.length === 0) throw marketError("bad-params", "decoded package is empty");
  return buf;
}

export function readVerifiedCachedIndex(dataDir, trust, now) {
  const indexPath = join(dataDir, INDEX_FILE);
  const sigPath = join(dataDir, INDEX_SIG_FILE);
  if (!existsSync(indexPath) || !existsSync(sigPath)) return { doc: null, error: null };
  try {
    const text = readFileSync(indexPath, "utf8");
    const signature = JSON.parse(readFileSync(sigPath, "utf8"));
    const opened = openIndex({ text, signature, trust, now });
    return opened.status === "ok" ? { doc: opened.doc, error: null } : { doc: null, error: opened.reason ?? opened.status };
  } catch (error) {
    return { doc: null, error: String(error?.message ?? error) };
  }
}

export function blockedView(plugin, selected, installed) {
  if (installed || selected.install || selected.manual || selected.autoUpdate) return null;
  const skipped = selected.skipped;
  if (!Array.isArray(skipped) || skipped.length === 0) return null;
  if (skipped.every((item) => item.reason === "engines")) {
    const byVersion = new Map((plugin.versions ?? []).map((entry) => [entry.version, entry]));
    const newest = skipped.map((item) => byVersion.get(item.version)).filter(Boolean).sort((a, b) => compareVersions(b.version, a.version))[0];
    const range = newest?.engines?.fuyu;
    return typeof range === "string" && range.trim() ? { reason: "engines", range: range.trim() } : { reason: "engines" };
  }
  if (skipped.every((item) => item.reason === "platform")) return { reason: "platform" };
  return null;
}

export function revocationView(revocations, name, version) {
  const rev = version ? revocationOf(revocations, name, version) : null;
  return rev ? { level: rev.level, reasons: rev.entries.map((entry) => entry.reason) } : null;
}

export function buildMarketSnapshot({ dataDir, pluginsDir, appVersion, platform, trust, now, lastSource = null }) {
  const state = readState(dataDir);
  const installedRaw = readInstalledPackages(pluginsDir);
  const installedById = new Map(installedRaw.map((item) => [item.id, item]));
  const { doc, error: indexError } = readVerifiedCachedIndex(dataDir, trust, now);
  const plugins = (doc?.plugins ?? []).map((plugin) => {
    const inst = installedById.get(plugin.name) ?? null;
    const official = plugin.publisher?.official === true;
    const pin = inst ? resolvePinnedAuthor(plugin, inst.version, state.trustedAuthors) : null;
    const selected = selectVersions(plugin, { fuyuVersion: appVersion, platform, now, installed: inst?.version ?? null, revocations: state.revocations });
    const metaFor = (item) => {
      if (!item?.entry) return {};
      const isUpgrade = Boolean(inst) && compareVersions(item.entry.version, inst.version) > 0;
      const trustChange = isUpgrade ? detectTrustChange(plugin, item.entry, pin) : null;
      const added = isUpgrade ? newCapabilities(inst.capabilities, item.entry.manifest) : null;
      const depPlan = planRequiredDependencies({ doc, rootName: plugin.name, rootEntry: item.entry, installedById, appVersion, platform, now, revocations: state.revocations });
      return { trustChange, newCapabilities: added, requiredPlugins: depPlan.map((dep) => dep.name) };
    };
    const installMeta = metaFor(selected.install);
    const manualMeta = metaFor(selected.manual);
    const autoMeta = metaFor(selected.autoUpdate);
    const primaryEntry = selected.install?.entry ?? selected.manual?.entry ?? plugin.versions?.[0];
    const manifest = isObject(primaryEntry?.manifest) ? primaryEntry.manifest : {};
    const revocation = inst ? revocationView(state.revocations, plugin.name, inst.version) : null;
    const instRevoked = revocation?.level === "disable";
    const allRevoked = !inst && Array.isArray(plugin.versions) && plugin.versions.length > 0 && selected.skipped.length === plugin.versions.length && selected.skipped.some((item) => item.reason === "revoked");
    return {
      name: plugin.name,
      official,
      publisher: { github: String(plugin.publisher?.github ?? ""), official },
      displayName: isObject(manifest.displayName) ? manifest.displayName : { "zh-CN": plugin.name, en: plugin.name },
      description: isObject(manifest.description) ? manifest.description : { "zh-CN": "", en: "" },
      categories: Array.isArray(manifest.categories) ? [...manifest.categories] : [],
      icon: pluginIcon(plugin, primaryEntry),
      screenshots: pluginScreenshots(plugin, primaryEntry),
      firstPublishedAt: firstPublishedAt(plugin),
      installedVersion: inst?.version ?? null,
      enabled: inst ? inst.enabled : false,
      source: inst?.source ?? null,
      revoked: Boolean(instRevoked || allRevoked),
      revocation,
      blocked: blockedView(plugin, selected, inst),
      install: candidateView(selected.install, official, selected.install ? { fresh: selected.install.fresh } : {}, installMeta),
      manual: candidateView(selected.manual, official, selected.manual ? { cooled: selected.manual.cooled, fresh: !selected.manual.cooled, warned: selected.manual.warned } : {}, manualMeta),
      autoUpdate: selected.autoUpdate && !autoMeta.trustChange && !autoMeta.newCapabilities ? candidateView(selected.autoUpdate, official, { urgent: selected.autoUpdate.urgent }, autoMeta) : null,
      autoUpdateHeld: selected.autoUpdate && !autoMeta.trustChange && autoMeta.newCapabilities
        ? { version: selected.autoUpdate.entry.version, reason: "new-capabilities", newCapabilities: autoMeta.newCapabilities }
        : null,
    };
  });
  const installed = installedRaw.map(({ id, version, source, enabled, displayName, description, icon, reach }) => ({
    id,
    version,
    source,
    enabled,
    revocation: revocationView(state.revocations, id, version),
    ...(displayName !== undefined ? { displayName } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(reach !== undefined ? { reach } : {}),
  }));
  return {
    plugins,
    installed,
    marketSince: marketSince(doc),
    updatedAt: state.updatedAt,
    manualAllowed: state.manualAllowed === true,
    error: indexError ?? state.lastError ?? null,
    revocationWarning: state.revocationWarning ?? null,
    lastSource: lastSource ?? state.lastSource ?? null,
  };
}
