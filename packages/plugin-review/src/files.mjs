import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRS = new Set([".git", "node_modules"]);
export const CODE_EXTENSIONS = /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/i;
export const LOCKFILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml"]);
const EXECUTABLE_EXTENSIONS = new Set([".exe", ".dll", ".sys", ".scr", ".com", ".msi", ".so", ".dylib", ".bin", ".elf", ".app", ".appimage", ".deb", ".rpm", ".pkg", ".dmg", ".wasm", ".jar", ".class"]);
const SCRIPT_EXTENSIONS = /\.(?:sh|bash|zsh|ps1|psm1|bat|cmd|command|vbs|applescript|scpt)$/i;
const ASSET_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|ico|icns|bmp|avif|woff2?|ttf|otf|eot|mp3|wav|ogg|m4a|flac|mp4|webm|pdf)$/i;
const MACHO = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xbebafeca, 0xcafebabf, 0xbfbafeca]);

function extensionOf(path) {
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot) : "";
}

export function zipEntryNames(data) {
  const names = new Set();
  for (const [signature, nameAt, lengthAt] of [[Buffer.from([0x50, 0x4b, 0x03, 0x04]), 30, 26], [Buffer.from([0x50, 0x4b, 0x01, 0x02]), 46, 28]]) {
    for (let at = data.indexOf(signature); at >= 0 && at + nameAt <= data.length; at = data.indexOf(signature, at + 4)) {
      const length = data.readUInt16LE(at + lengthAt);
      if (at + nameAt + length <= data.length) names.add(data.toString("utf8", at + nameAt, at + nameAt + length));
    }
  }
  return [...names];
}

const isJarEntry = (name) => name === "META-INF/MANIFEST.MF" || name.toLowerCase().endsWith(".class");

export function executableKind(data) {
  if (data.length >= 2 && data[0] === 0x4d && data[1] === 0x5a) return "PE";
  if (data.length < 4) return null;
  const magic = data.readUInt32BE(0);
  if (magic === 0x7f454c46) return "ELF";
  if (magic === 0xcafebabe) return data.length >= 8 && data.readUInt32BE(4) >= 45 ? "Java class" : "Mach-O";
  if (MACHO.has(magic)) return "Mach-O";
  if (magic === 0x0061736d) return "WebAssembly";
  if (magic === 0x504b0304 && zipEntryNames(data).some(isJarEntry)) return "Java archive";
  return null;
}

function classify(path, buffer) {
  const binary = buffer.subarray(0, 8000).includes(0);
  const extension = extensionOf(path);
  if (extension === ".node") return { kind: "native", label: ".node" };
  const magic = executableKind(buffer);
  if (magic) return { kind: "executable", label: magic };
  if (EXECUTABLE_EXTENSIONS.has(extension)) return { kind: "executable", label: extension };
  if (SCRIPT_EXTENSIONS.test(path)) return { kind: "script" };
  if (binary) return { kind: ASSET_EXTENSIONS.test(path) ? "asset" : "binary" };
  if (ASSET_EXTENSIONS.test(path)) return { kind: "asset" };
  return { kind: "text" };
}

export function readTree(root) {
  const files = new Map();
  const symlinks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      const path = relative(root, full).split(sep).join("/");
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) {
        symlinks.push(path);
        continue;
      }
      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (!stat.isFile()) continue;
      const buffer = readFileSync(full);
      const { kind, label } = classify(path, buffer);
      files.set(path, {
        path,
        kind,
        ...(label ? { label } : {}),
        size: buffer.length,
        hash: createHash("sha256").update(buffer).digest("hex"),
        text: kind === "text" || kind === "script" ? buffer.toString("utf8") : null,
      });
    }
  };
  walk(root);
  return { root, files, symlinks };
}

export function countLines(text) {
  if (!text) return 0;
  const lines = text.split(/\r?\n/);
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

export function lineDelta(oldText, newText) {
  const counts = new Map();
  const split = (text) => (text ? text.split(/\r?\n/).filter((line, index, all) => index < all.length - 1 || line !== "") : []);
  for (const line of split(oldText)) counts.set(line, (counts.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of split(newText)) {
    const left = counts.get(line) ?? 0;
    if (left > 0) counts.set(line, left - 1);
    else added += 1;
  }
  let removed = 0;
  for (const left of counts.values()) removed += left;
  return { added, removed };
}
