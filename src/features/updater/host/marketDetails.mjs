import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGES_SUBDIR } from "../../../../packages/plugin-cli/src/installer.mjs";
import { compareVersions, selectVersions } from "../../../../packages/plugin-market/src/index.mjs";
import { isObject, marketError, readState, readVerifiedCachedIndex } from "./marketStore.mjs";

const REMOTE_DOC_TIMEOUT_MS = 4000;
const SCOPED_PACKAGE_RE = /^@([a-z0-9][a-z0-9._~-]*)\/([a-z0-9][a-z0-9._~-]*)$/i;
const GITHUB_SHORTHAND_RE = /^github:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i;
const GITHUB_URL_RE = /^(?:git\+)?https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/.*)?$/i;
const COMMIT_HEX_RE = /^[0-9a-f]{40}$/i;

function cleanSubPath(raw, allowOuterSlashes = false) {
  if (typeof raw !== "string") return null;
  let text = raw.trim().replace(/^\.\//, "");
  if (allowOuterSlashes) text = text.replace(/^\/+|\/+$/g, "");
  else if (text.startsWith("/") || text.endsWith("/")) return null;
  if (!text || text.includes("\\") || /[\u0000-\u001f\u007f]/.test(text)) return null;
  const parts = text.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}

function isHttpsUrl(raw) {
  if (typeof raw !== "string" || !raw.startsWith("https://")) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "";
  } catch {
    return false;
  }
}

function normalizeText(raw) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function normalizeStringArray(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return out;
}

function normalizeLocalizedRecord(raw) {
  if (typeof raw === "string" && raw.trim()) {
    const val = raw.trim();
    return { "zh-CN": val, en: val };
  }
  if (!isObject(raw)) return undefined;
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string" && val.trim()) out[key] = val;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeAuthor(raw) {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (isObject(raw) && typeof raw.name === "string" && raw.name.trim()) {
    const name = raw.name.trim();
    const email = typeof raw.email === "string" && raw.email.trim() ? ` <${raw.email.trim()}>` : "";
    return `${name}${email}`;
  }
  return null;
}

function normalizeLinkField(raw) {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (isObject(raw) && typeof raw.url === "string" && raw.url.trim()) return raw.url.trim();
  if (Array.isArray(raw) && raw.length > 0) return normalizeLinkField(raw[0]);
  return null;
}

function parseRepositoryInfo(raw) {
  const rawStr = isObject(raw) && typeof raw.url === "string" ? raw.url : typeof raw === "string" ? raw : null;
  if (!rawStr || !rawStr.trim()) return { url: null, owner: null, repo: null, directory: isObject(raw) ? raw.directory : null };
  const trimmed = rawStr.trim();
  const shortMatch = GITHUB_SHORTHAND_RE.exec(trimmed);
  if (shortMatch && shortMatch[1] !== "." && shortMatch[1] !== ".." && shortMatch[2] !== "." && shortMatch[2] !== "..") {
    return {
      url: `https://github.com/${shortMatch[1]}/${shortMatch[2]}`,
      owner: shortMatch[1],
      repo: shortMatch[2],
      directory: isObject(raw) ? raw.directory : null,
    };
  }
  const ghMatch = GITHUB_URL_RE.exec(trimmed);
  if (ghMatch && ghMatch[1] !== "." && ghMatch[1] !== ".." && ghMatch[2] !== "." && ghMatch[2] !== "..") {
    return {
      url: `https://github.com/${ghMatch[1]}/${ghMatch[2]}`,
      owner: ghMatch[1],
      repo: ghMatch[2],
      directory: isObject(raw) ? raw.directory : null,
    };
  }
  return {
    url: trimmed.replace(/^git\+/, "").replace(/\.git$/, ""),
    owner: null,
    repo: null,
    directory: isObject(raw) ? raw.directory : null,
  };
}

function buildRawGithubBase({ name, official, versionEntry, repoInfo }) {
  if (!repoInfo.owner || !repoInfo.repo) return null;
  const commit = typeof versionEntry?.commit === "string" && COMMIT_HEX_RE.test(versionEntry.commit)
    ? versionEntry.commit.toLowerCase()
    : null;
  if (!commit) return null;
  const explicitDir = cleanSubPath(
    versionEntry?.path ?? versionEntry?.directory ?? (isObject(versionEntry?.manifest) ? versionEntry.manifest.path : null) ?? repoInfo.directory,
    true,
  );
  let prefix = "";
  if (explicitDir) {
    prefix = `${explicitDir}/`;
  } else if (official && typeof name === "string" && name.startsWith("@fuyu/")) {
    const slug = cleanSubPath(name.slice("@fuyu/".length), false);
    if (slug) prefix = `plugins/v3/official/${slug}/`;
  }
  return `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${commit}/${prefix}`;
}

function readLocalInstalledPlugin(pluginsDir, name) {
  const match = SCOPED_PACKAGE_RE.exec(name);
  if (!match || match[1] === "." || match[1] === ".." || match[2] === "." || match[2] === "..") return null;
  const packagesRoot = join(pluginsDir, PACKAGES_SUBDIR);
  if (!existsSync(packagesRoot)) return null;
  const candidateDirs = [join(packagesRoot, `@${match[1].toLowerCase()}`, match[2])];
  if (match[1] !== match[1].toLowerCase()) candidateDirs.push(join(packagesRoot, `@${match[1]}`, match[2]));
  for (const dir of candidateDirs) {
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (isObject(pkg) && pkg.name === name && typeof pkg.version === "string") {
        return { dir, pkg };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function readLocalDocFile(dir, candidates) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const exact = entries.find((entry) => entry.isFile() && entry.name === candidate);
    const matched = exact ?? entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === lower);
    if (!matched) continue;
    try {
      return readFileSync(join(dir, matched.name), "utf8");
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchRemoteText(fetchImpl, url, timeoutMs = REMOTE_DOC_TIMEOUT_MS) {
  if (typeof fetchImpl !== "function") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res?.ok || typeof res.text !== "function") return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFirstRemoteDoc(fetchImpl, rawBase, candidates) {
  if (!rawBase) return null;
  for (const filename of candidates) {
    const text = await fetchRemoteText(fetchImpl, `${rawBase}${filename}`);
    if (text !== null) return text;
  }
  return null;
}

function resolveScreenshots({ versionEntry, entryManifest, localFuyu, rawBase }) {
  const entryShots = Array.isArray(versionEntry?.screenshots) ? versionEntry.screenshots : null;
  const manifestShots = Array.isArray(entryManifest?.screenshots)
    ? entryManifest.screenshots
    : Array.isArray(localFuyu?.screenshots)
      ? localFuyu.screenshots
      : null;
  const sourceShots = entryShots?.length ? entryShots : (manifestShots ?? []);
  const out = [];
  for (let i = 0; i < sourceShots.length; i += 1) {
    const shot = sourceShots[i];
    if (!isObject(shot)) continue;
    let url = null;
    if (isHttpsUrl(shot.url)) {
      url = shot.url;
    } else if (rawBase) {
      const rel = cleanSubPath(shot.path, false);
      if (rel) url = `${rawBase}${rel}`;
    }
    if (!url) continue;
    const caption = normalizeLocalizedRecord(shot.caption ?? manifestShots?.[i]?.caption);
    out.push(caption ? { url, caption } : { url });
  }
  return out;
}

function normalizeCommands(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.id !== "string" || !item.id.trim()) continue;
    const id = item.id.trim();
    const title = normalizeLocalizedRecord(item.title) ?? { "zh-CN": id, en: id };
    const keybinding = normalizeText(item.keybinding);
    out.push(keybinding ? { id, title, keybinding } : { id, title });
  }
  return out;
}

function normalizeRequires(raw) {
  if (!isObject(raw)) return {};
  const out = {};
  for (const [dep, range] of Object.entries(raw)) {
    if (typeof range === "string" && range.trim()) out[dep] = range.trim();
  }
  return out;
}

function normalizeLikes(pluginEntry) {
  if (typeof pluginEntry?.likes === "number" && Number.isFinite(pluginEntry.likes) && pluginEntry.likes >= 0) {
    return pluginEntry.likes;
  }
  if (typeof pluginEntry?.stars === "number" && Number.isFinite(pluginEntry.stars) && pluginEntry.stars >= 0) {
    return pluginEntry.stars;
  }
  return null;
}

export async function getMarketPluginDetails(params, context) {
  if (!isObject(params) || typeof params.name !== "string" || !params.name.trim()) {
    throw marketError("bad-params", "details expects { name, locale? }");
  }
  const name = params.name.trim();
  const locale = typeof params.locale === "string" ? params.locale : "";
  const { dataDir, pluginsDir, appVersion, platform, trust, fetchImpl, now } = context;

  const state = readState(dataDir);
  const { doc } = readVerifiedCachedIndex(dataDir, trust, now);
  const pluginEntry = doc?.plugins?.find((item) => item.name === name) ?? null;
  const localInstalled = readLocalInstalledPlugin(pluginsDir, name);

  if (!pluginEntry && !localInstalled) {
    throw marketError("not-found", `Plugin ${name} not found`);
  }

  const localPkg = localInstalled?.pkg ?? null;
  const localFuyu = isObject(localPkg?.fuyu) ? localPkg.fuyu : null;
  const sortedVersions = Array.isArray(pluginEntry?.versions)
    ? [...pluginEntry.versions].sort((a, b) => compareVersions(b.version, a.version))
    : [];
  const selected = pluginEntry
    ? selectVersions(pluginEntry, { fuyuVersion: appVersion, platform, now, installed: null, revocations: state.revocations })
    : null;
  const latestEntry = selected?.manual?.entry ?? selected?.install?.entry ?? sortedVersions[0] ?? null;
  const entryManifest = isObject(latestEntry?.manifest) ? latestEntry.manifest : null;
  const official = pluginEntry?.publisher?.official === true;

  const repoInfo = parseRepositoryInfo(latestEntry?.repository ?? entryManifest?.repository ?? localPkg?.repository);
  const rawBase = buildRawGithubBase({ name, official, versionEntry: latestEntry, repoInfo });

  const readmeCandidates = locale.toLowerCase().startsWith("zh")
    ? ["README.zh-CN.md", "README.md"]
    : ["README.md", "README.zh-CN.md"];
  const changelogCandidates = ["CHANGELOG.md"];

  let readme = null;
  let changelog = null;
  if (localInstalled) {
    readme = readLocalDocFile(localInstalled.dir, readmeCandidates);
    changelog = readLocalDocFile(localInstalled.dir, changelogCandidates);
  } else if (rawBase) {
    [readme, changelog] = await Promise.all([
      fetchFirstRemoteDoc(fetchImpl, rawBase, readmeCandidates),
      fetchFirstRemoteDoc(fetchImpl, rawBase, changelogCandidates),
    ]);
  }

  const displayName = normalizeLocalizedRecord(entryManifest?.displayName ?? localFuyu?.displayName);
  const description = normalizeLocalizedRecord(entryManifest?.description ?? localFuyu?.description ?? localPkg?.description);
  const publisherName = normalizeText(pluginEntry?.publisher?.github ?? pluginEntry?.publisher?.name);

  const versions = sortedVersions.length > 0
    ? sortedVersions.map((entry) => ({
      version: String(entry.version),
      publishedAt: typeof entry.publishedAt === "string" ? entry.publishedAt : null,
      size: typeof entry.size === "number" ? entry.size : null,
      reviewed: Boolean(entry.reviewedAt || entry.reviewed === true),
      urgent: Boolean(entry.urgent),
      enginesFuyu: typeof entry.engines?.fuyu === "string" ? entry.engines.fuyu : null,
    }))
    : localPkg
      ? [{
        version: localPkg.version,
        publishedAt: null,
        size: null,
        reviewed: false,
        urgent: false,
        enginesFuyu: typeof localPkg.engines?.fuyu === "string" ? localPkg.engines.fuyu : null,
      }]
      : [];

  return {
    name: pluginEntry?.name ?? localPkg?.name ?? name,
    ...(displayName ? { displayName } : {}),
    ...(description ? { description } : {}),
    official,
    ...(publisherName ? { publisherName } : {}),
    author: normalizeAuthor(entryManifest?.author ?? latestEntry?.author ?? localPkg?.author),
    license: normalizeText(entryManifest?.license ?? latestEntry?.license ?? localPkg?.license),
    homepage: normalizeText(entryManifest?.homepage ?? latestEntry?.homepage ?? localPkg?.homepage),
    repository: repoInfo.url,
    bugs: normalizeLinkField(entryManifest?.bugs ?? latestEntry?.bugs ?? localPkg?.bugs),
    funding: normalizeLinkField(entryManifest?.funding ?? latestEntry?.funding ?? localPkg?.funding),
    keywords: normalizeStringArray(entryManifest?.keywords ?? latestEntry?.keywords ?? localPkg?.keywords ?? localFuyu?.keywords),
    categories: normalizeStringArray(entryManifest?.categories ?? localFuyu?.categories),
    platforms: normalizeStringArray(latestEntry?.platforms ?? entryManifest?.platforms ?? localFuyu?.platforms),
    preview: Boolean(entryManifest?.preview ?? localFuyu?.preview ?? false),
    likes: normalizeLikes(pluginEntry),
    installedVersion: localPkg?.version ?? null,
    latestVersion: latestEntry?.version ?? localPkg?.version ?? null,
    readme,
    changelog,
    screenshots: resolveScreenshots({ versionEntry: latestEntry, entryManifest, localFuyu, rawBase }),
    commands: normalizeCommands(entryManifest?.commands ?? localFuyu?.commands),
    slots: normalizeStringArray(entryManifest?.slots ?? localFuyu?.slots),
    provides: normalizeStringArray(entryManifest?.provides ?? localFuyu?.provides),
    replaces: normalizeStringArray(entryManifest?.replaces ?? localFuyu?.replaces),
    network: normalizeStringArray(entryManifest?.network ?? localFuyu?.network),
    nodeApis: normalizeStringArray(entryManifest?.nodeApis ?? localFuyu?.nodeApis),
    requires: normalizeRequires(entryManifest?.requires ?? localFuyu?.requires),
    versions,
  };
}
