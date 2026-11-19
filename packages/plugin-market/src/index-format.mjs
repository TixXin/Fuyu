import { checkBundles } from "./bundles.mjs";
import { isPublicKeyEntry, isSignatureObject } from "./keys.mjs";
import { isValidRange, isValidVersion } from "./semver.mjs";
import {
  checkUnique,
  githubOwner,
  isCount,
  isHex,
  isHttpsUrl,
  isLocalized,
  isObject,
  isText,
  isTextArray,
  isTime,
  problems,
  timeOf,
} from "./fields.mjs";

export const FORMAT = 3;
export const PLATFORMS = ["windows", "macos"];
export const MAX_SCREENSHOTS = 6;
export const MAX_KEYWORDS = 32;
export const MAX_DOCS = 16;
export const DOC_NAME = /^(?:README|CHANGELOG)(?:\.[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)?\.md$/i;
export const DEFAULT_MARKET = Object.freeze({
  officialScope: "fuyu",
  officialRepository: "https://github.com/TixXin/fuyu",
});

const NAME = /^@([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9._-]*)$/;
const MANIFEST_LISTS = ["nodeApis", "network", "provides", "replaces", "slots"];

export function parseName(name) {
  if (typeof name !== "string" || name.length > 214) return null;
  const match = NAME.exec(name);
  return match ? { scope: match[1], name: match[2] } : null;
}

export function checkHeader(report, doc) {
  if (!report.check(isObject(doc), "", "must be a JSON object")) return false;
  report.check(doc.format === FORMAT, "format", `must be ${FORMAT}`);
  report.check(isCount(doc.serial), "serial", "must be a non-negative integer");
  report.check(isTime(doc.generatedAt), "generatedAt", "must be an ISO 8601 time with a zone");
  report.check(isTime(doc.expires), "expires", "must be an ISO 8601 time with a zone");
  if (isTime(doc.generatedAt) && isTime(doc.expires)) {
    report.check(timeOf(doc.expires) > timeOf(doc.generatedAt), "expires", "must be after generatedAt");
  }
  return true;
}

function checkAsset(report, asset, path) {
  if (!report.check(isObject(asset), path, "must be { url, sha256 }")) return;
  report.check(isHttpsUrl(asset.url), `${path}.url`, "must be an https URL");
  report.check(isHex(asset.sha256, 64), `${path}.sha256`, "must be 64 lowercase hex digits");
}

function checkManifest(report, manifest, path) {
  if (!report.check(isObject(manifest), path, "must be an object")) return;
  report.check(isLocalized(manifest.displayName), `${path}.displayName`, "needs zh-CN and en");
  report.check(isLocalized(manifest.description), `${path}.description`, "needs zh-CN and en");
  report.check(isText(manifest.license), `${path}.license`, "must be a license name");
  for (const key of MANIFEST_LISTS) {
    report.check(isTextArray(manifest[key]), `${path}.${key}`, "must be a list of strings");
  }
  const inject = manifest.inject;
  if (report.check(isObject(inject), `${path}.inject`, "must be { required, optional }")) {
    report.check(isTextArray(inject.required), `${path}.inject.required`, "must be a list of strings");
    report.check(isTextArray(inject.optional), `${path}.inject.optional`, "must be a list of strings");
  }
  if (report.check(Array.isArray(manifest.commands), `${path}.commands`, "must be a list")) {
    manifest.commands.forEach((command, i) => {
      report.check(isObject(command) && isText(command.id), `${path}.commands[${i}]`, "needs an id");
    });
  }
  if (manifest.categories !== undefined) report.check(isTextArray(manifest.categories), `${path}.categories`, "must be a list of strings");
  if (manifest.keywords !== undefined) {
    report.check(isTextArray(manifest.keywords) && manifest.keywords.length <= MAX_KEYWORDS, `${path}.keywords`, `must be a list of at most ${MAX_KEYWORDS} strings`);
  }
  if (manifest.preview !== undefined) report.check(typeof manifest.preview === "boolean", `${path}.preview`, "must be true or false");
  if (manifest.requires !== undefined) {
    const ok = isObject(manifest.requires) && Object.values(manifest.requires).every(isValidRange);
    report.check(ok, `${path}.requires`, "must map plugin names to version ranges");
  }
}

function checkDocs(report, docs, path) {
  if (!report.check(isObject(docs) && Object.keys(docs).length <= MAX_DOCS, path, `must map at most ${MAX_DOCS} file names to SHA-256`)) return;
  const seen = new Set();
  for (const [name, sha256] of Object.entries(docs)) {
    const lower = name.toLowerCase();
    report.check(DOC_NAME.test(name) && !seen.has(lower), `${path}.${name}`, "must be a README or CHANGELOG .md file name, listed once");
    report.check(isHex(sha256, 64), `${path}.${name}`, "must be 64 lowercase hex digits");
    seen.add(lower);
  }
}

function checkVersion(report, entry, path, plugin, options) {
  if (!report.check(isObject(entry), path, "must be an object")) return;
  report.check(isValidVersion(entry.version), `${path}.version`, "must be a semver version");
  const owner = githubOwner(entry.repository);
  if (report.check(owner !== null, `${path}.repository`, "must be https://github.com/<owner>/<repo>")) {
    const scope = parseName(plugin.name)?.scope;
    if (plugin.publisher?.official === true) {
      report.check(entry.repository === options.officialRepository, `${path}.repository`, `official plugins come from ${options.officialRepository}`);
    } else if (scope) {
      report.check(owner.toLowerCase() === scope, `${path}.repository`, `the owner must be the name's scope @${scope}`);
    }
  }
  report.check(isHex(entry.commit, 40), `${path}.commit`, "must be a full 40-digit commit id");
  report.check(isObject(entry.engines) && isValidRange(entry.engines.fuyu) && entry.engines.fuyu.trim() !== "", `${path}.engines.fuyu`, "must be a version range");
  const platforms = entry.platforms;
  const platformsOk = Array.isArray(platforms) && platforms.length > 0 && platforms.every((p) => PLATFORMS.includes(p)) && new Set(platforms).size === platforms.length;
  report.check(platformsOk, `${path}.platforms`, `must list some of ${PLATFORMS.join(", ")}`);
  report.check(isHttpsUrl(entry.url), `${path}.url`, "must be an https URL");
  report.check(isHex(entry.sha256, 64), `${path}.sha256`, "must be 64 lowercase hex digits");
  report.check(Number.isSafeInteger(entry.size) && entry.size > 0, `${path}.size`, "must be a positive byte count");
  report.check(isTime(entry.publishedAt), `${path}.publishedAt`, "must be an ISO 8601 time with a zone");
  report.check(isTime(entry.reviewedAt), `${path}.reviewedAt`, "must be an ISO 8601 time with a zone");
  if (entry.urgent !== undefined) {
    report.check(isObject(entry.urgent) && isLocalized(entry.urgent.reason), `${path}.urgent.reason`, "needs zh-CN and en");
  }
  if (plugin.publisher?.official === true) {
    report.check(entry.authorSignature === undefined, `${path}.authorSignature`, "official plugins are vouched for by the protected main, not a key");
  } else if (report.check(isSignatureObject(entry.authorSignature), `${path}.authorSignature`, "must be { keyId, signature }")) {
    const known = (plugin.authorKeys ?? []).some((key) => key?.keyId === entry.authorSignature.keyId);
    report.check(known, `${path}.authorSignature.keyId`, "must be one of the plugin's authorKeys");
  }
  checkManifest(report, entry.manifest, `${path}.manifest`);
  checkAsset(report, entry.icon, `${path}.icon`);
  if (entry.screenshots !== undefined) {
    const list = entry.screenshots;
    if (report.check(Array.isArray(list) && list.length <= MAX_SCREENSHOTS, `${path}.screenshots`, `must be a list of at most ${MAX_SCREENSHOTS}`)) {
      list.forEach((shot, i) => checkAsset(report, shot, `${path}.screenshots[${i}]`));
    }
  }
  if (entry.docs !== undefined) checkDocs(report, entry.docs, `${path}.docs`);
}

function checkPublisher(report, publisher, path, scope, options) {
  if (!report.check(isObject(publisher), path, "must be an object")) return;
  report.check(isText(publisher.github), `${path}.github`, "must be the GitHub account");
  report.check(typeof publisher.official === "boolean", `${path}.official`, "must be true or false");
  const officialScope = scope === options.officialScope;
  report.check(publisher.official === officialScope, `${path}.official`, `only @${options.officialScope}/* is official`);
  if (publisher.verified !== undefined) {
    const v = publisher.verified;
    const ok = isObject(v) && (v.via === "github" || (v.via === "domain" && /^[a-z0-9.-]+$/.test(v.domain ?? "")));
    report.check(ok, `${path}.verified`, 'must be { via: "github" } or { via: "domain", domain }');
  }
}

function checkPlugin(report, plugin, path, options) {
  if (!report.check(isObject(plugin), path, "must be an object")) return;
  const parsed = parseName(plugin.name);
  report.check(parsed !== null, `${path}.name`, "must be @<scope>/<name> in lowercase");
  checkPublisher(report, plugin.publisher, `${path}.publisher`, parsed?.scope, options);
  const official = plugin.publisher?.official === true;
  const keysOk = Array.isArray(plugin.authorKeys) && plugin.authorKeys.every(isPublicKeyEntry) && (official || plugin.authorKeys.length > 0);
  report.check(keysOk, `${path}.authorKeys`, official ? "must be a list of { keyId, publicKey }" : "must list at least one { keyId, publicKey }");
  if (Array.isArray(plugin.authorKeys)) checkUnique(report, plugin.authorKeys, (key) => key?.keyId, `${path}.authorKeys`, "keyId");
  if (!report.check(Array.isArray(plugin.versions) && plugin.versions.length > 0, `${path}.versions`, "must list at least one version")) return;
  plugin.versions.forEach((entry, i) => checkVersion(report, entry, `${path}.versions[${i}]`, plugin, options));
  checkUnique(report, plugin.versions, (entry) => entry?.version, `${path}.versions`, "version");
}

export function validateIndex(doc, options = {}) {
  const settings = { ...DEFAULT_MARKET, ...options };
  const report = problems();
  if (!checkHeader(report, doc)) return report.list;
  if (doc.revokedSerial !== undefined) report.check(isCount(doc.revokedSerial), "revokedSerial", "must be a non-negative integer");
  if (!report.check(Array.isArray(doc.plugins), "plugins", "must be a list")) return report.list;
  doc.plugins.forEach((plugin, i) => checkPlugin(report, plugin, `plugins[${i}]`, settings));
  checkUnique(report, doc.plugins, (plugin) => plugin?.name, "plugins", "name");
  checkBundles(report, doc, parseName);
  return report.list;
}
