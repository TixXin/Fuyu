import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRS = new Set([".git", "node_modules"]);
export const CODE_EXTENSIONS = /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/i;
export const LOCKFILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml"]);
const EXECUTABLE_EXTENSIONS = /\.(?:exe|dll|so|dylib|com|scr|msi|app|bin|elf|jar|wasm)$/i;
const SCRIPT_EXTENSIONS = /\.(?:sh|bash|zsh|ps1|psm1|bat|cmd|command|vbs|applescript|scpt)$/i;
const ASSET_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|ico|icns|bmp|avif|woff2?|ttf|otf|eot|mp3|wav|ogg|m4a|flac|mp4|webm|pdf)$/i;

function magicKind(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) return "pe";
  if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x7f454c46) return "elf";
  if (buffer.length >= 4) {
    const word = buffer.readUInt32BE(0);
    if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(word)) return "macho";
  }
  if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x0061736d) return "wasm";
  return null;
}

function classify(path, buffer) {
  const head = buffer.subarray(0, 8000);
  const binary = head.includes(0);
  const magic = magicKind(buffer);
  if (/\.node$/i.test(path)) return "native";
  if (magic || EXECUTABLE_EXTENSIONS.test(path)) return "executable";
  if (SCRIPT_EXTENSIONS.test(path)) return "script";
  if (binary) return ASSET_EXTENSIONS.test(path) ? "asset" : "binary";
  if (ASSET_EXTENSIONS.test(path)) return "asset";
  return "text";
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
      const kind = classify(path, buffer);
      files.set(path, {
        path,
        kind,
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
