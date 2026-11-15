import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isSafeRelativePath } from "./manifest.mjs";
import { PackageError, createZip, readZip } from "./zip.mjs";

export { PackageError } from "./zip.mjs";

export const DEFAULT_NAMESPACE = "fuyu";
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 5000;
export const MANIFEST_FILE = "package.json";
export const TEXT_EXTENSIONS = [".js", ".mjs", ".cjs", ".json", ".css", ".html", ".htm", ".md", ".txt", ".svg", ".map", ".yml", ".yaml", ".xml", ".csv"];
export const BLOCKED_EXTENSIONS = [".node", ".exe", ".dll", ".sys", ".scr", ".com", ".msi", ".so", ".dylib", ".bin", ".elf", ".app", ".appimage", ".deb", ".rpm", ".pkg", ".dmg"];

const extensionOf = (path) => {
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot) : "";
};

export function resolvePackageOptions(options = {}) {
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  return {
    namespace,
    extension: options.extension ?? `.${namespace}`,
    signatureFile: options.signatureFile ?? `${namespace}-signature.json`,
    maxPackageBytes: options.maxPackageBytes ?? MAX_PACKAGE_BYTES,
    maxUnpackedBytes: options.maxUnpackedBytes ?? MAX_UNPACKED_BYTES,
    maxFiles: options.maxFiles ?? MAX_FILES,
  };
}

export function checkPackagePath(path) {
  if (typeof path !== "string" || !isSafeRelativePath(path)) return { code: "path", message: "must be a relative path with \"/\", no \"..\" and not absolute" };
  if (/[\u0000-\u001f\u007f]/.test(path)) return { code: "path", message: "contains control characters" };
  if (path.split("/").some((part) => part.toLowerCase() === "node_modules")) return { code: "node-modules", message: "node_modules is not allowed: bundle dependencies into dist/" };
  const extension = extensionOf(path);
  if (extension === ".node") return { code: "native", message: "native Node addons (.node) are not allowed" };
  if (BLOCKED_EXTENSIONS.includes(extension)) return { code: "executable", message: `${extension} files are not allowed` };
  return null;
}

function isPortableExecutable(data) {
  if (data.length < 64 || data[0] !== 0x4d || data[1] !== 0x5a) return false;
  const header = data.readUInt32LE(0x3c);
  return header + 4 <= data.length && data.readUInt32BE(header) === 0x50450000;
}

const MACHO = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca]);

export function executableKind(data) {
  if (data.length >= 4 && data.readUInt32BE(0) === 0x7f454c46) return "ELF";
  if (data.length >= 4 && MACHO.has(data.readUInt32BE(0))) return "Mach-O";
  if (isPortableExecutable(data)) return "PE";
  return null;
}

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

export function normalizeText(path, data) {
  if (!TEXT_EXTENSIONS.includes(extensionOf(path))) return data;
  let text;
  try {
    text = strictUtf8.decode(data);
  } catch {
    return data;
  }
  return text.includes("\r") ? Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8") : data;
}

const byPath = (left, right) => Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8"));

function checkEntries(entries, settings) {
  const seen = new Set();
  let total = 0;
  for (const { path, data } of entries) {
    const problem = checkPackagePath(path);
    if (problem) throw new PackageError(problem.code, problem.message, String(path));
    const folded = path.normalize("NFC").toLowerCase();
    if (seen.has(folded)) throw new PackageError("duplicate", "the path appears more than once (paths are compared without case)", path);
    seen.add(folded);
    const kind = executableKind(data);
    if (kind) throw new PackageError("executable", `${kind} executables are not allowed`, path);
    total += data.length;
  }
  if (entries.length > settings.maxFiles) throw new PackageError("too-many-files", `more than ${settings.maxFiles} files`);
  if (total > settings.maxUnpackedBytes) throw new PackageError("too-large", `unpacks to more than ${settings.maxUnpackedBytes} bytes`);
  if (!entries.some((entry) => entry.path === MANIFEST_FILE)) throw new PackageError("manifest", `${MANIFEST_FILE} is missing at the top of the package`);
}

function parseManifest(entries) {
  const file = entries.find((entry) => entry.path === MANIFEST_FILE);
  try {
    return JSON.parse(file.data.toString("utf8").replace(/^﻿/, ""));
  } catch {
    throw new PackageError("manifest", "is not valid JSON", MANIFEST_FILE);
  }
}

export const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");

export function packageDigest(entries, options = {}) {
  const settings = resolvePackageOptions(options);
  const lines = entries
    .filter((entry) => entry.path !== settings.signatureFile)
    .map((entry) => ({ path: entry.path, hash: sha256Hex(entry.data) }))
    .sort(byPath)
    .map((entry) => `${entry.hash} ${entry.path}\n`);
  return sha256Hex(`${settings.namespace}-package-digest/1\n${lines.join("")}`);
}

export function packFiles(files, options = {}) {
  const settings = resolvePackageOptions(options);
  const normalize = options.normalizeText === false ? (path, data) => data : normalizeText;
  const entries = files.map(({ path, data }) => ({ path, data: normalize(path, Buffer.isBuffer(data) ? data : Buffer.from(data)) })).sort(byPath);
  checkEntries(entries, settings);
  const zip = createZip(entries);
  if (zip.length > settings.maxPackageBytes) throw new PackageError("too-large", `the package is ${zip.length} bytes, over ${settings.maxPackageBytes}`);
  return { zip, digest: packageDigest(entries, settings), manifest: parseManifest(entries), files: entries };
}

export function collectFiles(dir) {
  const walk = (folder, prefix) =>
    readdirSync(folder).flatMap((name) => {
      const full = join(folder, name);
      const path = prefix + name;
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) throw new PackageError("symlink", "symbolic links are not allowed", path);
      if (stat.isDirectory()) return walk(full, `${path}/`);
      if (!stat.isFile()) throw new PackageError("special", "only regular files are allowed", path);
      return [{ path, data: readFileSync(full) }];
    });
  return walk(dir, "");
}

export const packDirectory = (dir, options = {}) => packFiles(collectFiles(dir), options);

export function readPackage(zip, options = {}) {
  const settings = resolvePackageOptions(options);
  if (!Buffer.isBuffer(zip)) throw new PackageError("zip", "expected the package bytes");
  if (zip.length > settings.maxPackageBytes) throw new PackageError("too-large", `the package is ${zip.length} bytes, over ${settings.maxPackageBytes}`);
  const entries = readZip(zip, settings);
  checkEntries(entries, settings);
  const signatureEntry = entries.find((entry) => entry.path === settings.signatureFile);
  let signatures = null;
  if (signatureEntry) {
    try {
      signatures = JSON.parse(signatureEntry.data.toString("utf8"));
    } catch {
      throw new PackageError("signature", "is not valid JSON", settings.signatureFile);
    }
  }
  return {
    files: entries.filter((entry) => entry !== signatureEntry),
    manifest: parseManifest(entries),
    digest: packageDigest(entries, settings),
    signatures,
  };
}

export function packageFileName(name, version, options = {}) {
  const { extension } = resolvePackageOptions(options);
  return `${String(name).replace(/^@/, "").replace(/\//g, "-")}-${version}${extension}`;
}
