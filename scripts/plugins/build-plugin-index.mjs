import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip, listFiles, packFolder, readPackedFile, sha256 } from "../../packages/fuyu-plugin/src/pack.mjs";
import { loadSigningKey, publicKeyOf, writePackageSignature } from "../../packages/fuyu-plugin/src/sign.mjs";
import { loadPrivateKey, signIndex } from "./plugin-signing.mjs";

export { createZip, listFiles, readPackedFile, sha256 };

export const MARKET_BASE_URL = "https://raw.githubusercontent.com/TixXin/fly-island/main/plugins";
export const INDEX_VERSION = 1;
const SOURCE_DIRS = ["plugins/examples"];
const PACKAGES_DIR = "plugins/packages";
const INDEX_PATH = "plugins/index.json";
const SIGNATURE_PATH = "plugins/index.json.sig";
export const REVOKED_PATH = "plugins/revoked.json";
const MARKET_DIR = "plugins/market";
const MANIFEST = "focusd-plugin.json";
export const AUTHOR_KEY_PATH = "plugins/author-key.json";
export const AUTHOR_KEY_FILE = path.join(homedir(), ".tauri", "fly-island", "plugin-author-signing.key");
export const OFFICIAL_PUBLISHER = "TixXin";
export const CATEGORIES = ["productivity", "todos", "developer", "media", "messages", "information", "utilities"];

export function runtimeRequirement(runtime) {
  if (runtime?.type !== "process") return "none";
  const extension = path.extname(runtime.command ?? "").toLowerCase();
  if (extension === ".exe") return "exe";
  if (extension === ".ps1") return "powershell";
  if ([".js", ".mjs", ".cjs"].includes(extension)) return "node";
  return "none";
}

export function marketDetails(root, id) {
  const file = path.join(root, MARKET_DIR, `${id}.json`);
  const details = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const unknown = (details.categories ?? []).filter((name) => !CATEGORIES.includes(name));
  if (unknown.length > 0) throw new Error(`${MARKET_DIR}/${id}.json: unknown categories ${unknown.join(", ")}.`);
  return {
    publisher: details.publisher ?? OFFICIAL_PUBLISHER,
    ...(details.repo ? { repo: details.repo } : {}),
    categories: [...new Set(details.categories ?? [])],
    ...(details.preRelease === true ? { preRelease: true } : {}),
  };
}

export const MAX_MARKET_TEXT = 16 * 1024;

export function marketText(text, limit = MAX_MARKET_TEXT) {
  const trimmed = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!trimmed) return null;
  if (trimmed.length <= limit) return trimmed;
  const cut = trimmed.slice(0, limit);
  const lineEnd = cut.lastIndexOf("\n");
  return `${(lineEnd > 0 ? cut.slice(0, lineEnd) : cut).trimEnd()}\n\n…`;
}

export function marketTexts(dir) {
  const read = (name) => {
    const file = path.join(dir, name);
    return existsSync(file) ? marketText(readFileSync(file, "utf8")) : null;
  };
  const readme = read("README.md");
  const changelog = read("CHANGELOG.md");
  return { ...(readme ? { readme } : {}), ...(changelog ? { changelog } : {}) };
}

export function optionalPermissions(manifest) {
  if ((manifest.apiVersion ?? 1) < 2) return [];
  const required = new Set(manifest.permissions ?? []);
  return [...new Set(manifest.optionalPermissions ?? [])].filter((name) => !required.has(name)).sort();
}

export function indexEntry(manifest, fileName, zip, details = {}) {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description ?? { "zh-CN": "", en: "" },
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    ...(manifest.minAppVersion ? { minAppVersion: manifest.minAppVersion } : {}),
    author: manifest.author ?? "",
    homepage: manifest.homepage ?? "",
    permissions: [...new Set(manifest.permissions ?? [])].sort(),
    ...(optionalPermissions(manifest).length > 0 ? { optionalPermissions: optionalPermissions(manifest) } : {}),
    runtime: runtimeRequirement(manifest.runtime),
    ...((manifest.contributes?.views ?? []).some((view) => view.template === "webview") ? { webview: true } : {}),
    ...details,
    download: { url: `${MARKET_BASE_URL}/packages/${fileName}`, sha256: sha256(zip), size: zip.length },
  };
}

export const packPlugin = packFolder;

export function loadAuthorKey(root, env = process.env) {
  const key = loadSigningKey({ file: AUTHOR_KEY_FILE, env, envName: "FOCUSD_PLUGIN_AUTHOR_KEY" });
  const expected = JSON.parse(readFileSync(path.join(root, AUTHOR_KEY_PATH), "utf8"));
  if (publicKeyOf(key).keyId !== expected.keyId) throw new Error(`The official author key is not ${expected.keyId} (${AUTHOR_KEY_PATH}).`);
  return key;
}

export function signPackages(root, loadKey = () => loadAuthorKey(root)) {
  const packagesDir = path.join(root, PACKAGES_DIR);
  let key = null;
  for (const name of readdirSync(packagesDir).filter((file) => file.endsWith(".zip")).sort()) {
    const file = path.join(packagesDir, name);
    if (existsSync(`${file}.sig`)) continue;
    const [id, version] = name.slice(0, -".zip".length).split(/-(?=\d+\.\d+\.\d+)/);
    key ??= loadKey();
    writePackageSignature(file, id, version, readFileSync(file), key);
  }
}

export function buildIndex(root, privateKey = loadPrivateKey()) {
  const packagesDir = path.join(root, PACKAGES_DIR);
  mkdirSync(packagesDir, { recursive: true });
  const entries = [];
  for (const source of SOURCE_DIRS) {
    const sourceDir = path.join(root, source);
    for (const name of readdirSync(sourceDir).sort()) {
      const dir = path.join(sourceDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const { manifest, fileName, zip } = packPlugin(dir);
      const target = path.join(packagesDir, fileName);
      if (existsSync(target) && !readFileSync(target).equals(zip)) {
        throw new Error(`${fileName} already exists with different contents; raise "version" in ${source}/${name}/${MANIFEST}.`);
      }
      writeFileSync(target, zip);
      entries.push(indexEntry(manifest, fileName, zip, { ...marketDetails(root, manifest.id), ...marketTexts(dir) }));
    }
  }
  entries.sort((left, right) => left.id.localeCompare(right.id));
  const index = { version: INDEX_VERSION, plugins: entries };
  const text = `${JSON.stringify(index, null, 2)}\n`;
  writeFileSync(path.join(root, INDEX_PATH), text);
  writeFileSync(path.join(root, SIGNATURE_PATH), `${JSON.stringify(signIndex(text, privateKey), null, 2)}\n`);
  signRevoked(root, privateKey);
  signPackages(root);
  return index;
}

export function signRevoked(root, privateKey) {
  const file = path.join(root, REVOKED_PATH);
  if (!existsSync(file)) writeFileSync(file, `${JSON.stringify({ version: 1, revoked: [] }, null, 2)}\n`);
  const text = readFileSync(file, "utf8");
  const list = JSON.parse(text);
  if (list.version !== 1 || !Array.isArray(list.revoked)) throw new Error(`${REVOKED_PATH} must be { "version": 1, "revoked": [...] }.`);
  writeFileSync(`${file}.sig`, `${JSON.stringify(signIndex(text, privateKey), null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const index = buildIndex(root);
  console.log(`Wrote ${INDEX_PATH} with ${index.plugins.length} plugin(s).`);
}
