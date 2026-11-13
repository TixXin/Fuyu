import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";
import { isIgnored, loadIgnore } from "./ignore.mjs";

const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const TEXT_EXTENSIONS = new Set([".json", ".js", ".mjs", ".cjs", ".ps1", ".md", ".txt", ".css", ".html"]);

export function readPackedFile(full) {
  const data = readFileSync(full);
  return TEXT_EXTENSIONS.has(path.extname(full).toLowerCase())
    ? Buffer.from(data.toString("utf8").replaceAll("\r\n", "\n"), "utf8")
    : data;
}

export function listFiles(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      const zipPath = prefix + entry.name;
      return entry.isDirectory() ? listFiles(full, `${zipPath}/`) : [[zipPath, full]];
    });
}

export function createZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBytes = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const header = (signature, size) => {
      const buffer = Buffer.alloc(size);
      buffer.writeUInt32LE(signature, 0);
      return buffer;
    };
    const local = header(0x04034b50, 30);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, compressed);

    const central = header(0x02014b50, 46);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

export function readZip(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("Not a zip file.");
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = [];
  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error("Broken zip directory.");
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const skip = nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    const name = zip.toString("utf8", at + 46, at + 46 + nameLength);
    const local = zip.readUInt32LE(at + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const stored = zip.subarray(start, start + size);
    files.push([name, method === 8 ? inflateRawSync(stored) : Buffer.from(stored)]);
    at += 46 + skip;
  }
  return files;
}

export function sameZipContents(left, right) {
  const a = readZip(left);
  const b = readZip(right);
  return a.length === b.length && a.every(([name, data], index) => b[index][0] === name && b[index][1].equals(data));
}

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

export const MANIFEST_FILE = "fuyu-plugin.json";
export const LEGACY_MANIFEST_FILE = "focusd-plugin.json";

export function manifestFileOf(dir) {
  return existsSync(path.join(dir, MANIFEST_FILE)) || !existsSync(path.join(dir, LEGACY_MANIFEST_FILE)) ? MANIFEST_FILE : LEGACY_MANIFEST_FILE;
}

export function readManifest(dir) {
  return JSON.parse(readFileSync(path.join(dir, manifestFileOf(dir)), "utf8").replace(/^\uFEFF/, ""));
}

export function packageFiles(dir) {
  const rules = loadIgnore(dir);
  const files = listFiles(dir)
    .filter(([name]) => !isIgnored(rules, name))
    .map(([name, full]) => [name, readPackedFile(full)]);
  const at = files.findIndex(([name]) => name === MANIFEST_FILE);
  if (at >= 0 && !files.some(([name]) => name === LEGACY_MANIFEST_FILE)) files.splice(at + 1, 0, [LEGACY_MANIFEST_FILE, files[at][1]]);
  return files;
}

export function packFolder(dir) {
  const manifest = readManifest(dir);
  if (path.basename(path.resolve(dir)) !== manifest.id) {
    throw new Error(`${dir}: the folder must be named after the plugin id "${manifest.id}".`);
  }
  return { manifest, fileName: `${manifest.id}-${manifest.version}.zip`, zip: createZip(packageFiles(dir)) };
}
