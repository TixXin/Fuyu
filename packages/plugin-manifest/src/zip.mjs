import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const UTF8 = 0x0800;
const UNIX = 3;
const FILE_MODE = 0o100644;

export class PackageError extends Error {
  constructor(code, message, path) {
    super(path ? `${path}: ${message}` : message);
    this.name = "PackageError";
    this.code = code;
    if (path) this.path = path;
  }
}

export function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { path, data } of entries) {
    const name = Buffer.from(path, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE((UNIX << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((FILE_MODE << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
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

function findEnd(zip) {
  const earliest = Math.max(0, zip.length - 22 - 0xffff);
  for (let at = zip.length - 22; at >= earliest; at -= 1) {
    if (zip.readUInt32LE(at) === END && at + 22 + zip.readUInt16LE(at + 20) === zip.length) return at;
  }
  throw new PackageError("zip", "not a zip file");
}

function entryKind(madeBy, external, name) {
  const mode = madeBy >> 8 === UNIX ? external >>> 16 : 0;
  const type = mode & 0o170000;
  if (type === 0o120000) return "symlink";
  if (type === 0o040000 || (external & 0x10) !== 0 || name.endsWith("/")) return "directory";
  if (type !== 0 && type !== 0o100000) return "special";
  return "file";
}

const decoder = new TextDecoder("utf-8", { fatal: true });

export function readZip(zip, { maxFiles, maxUnpackedBytes }) {
  if (!Buffer.isBuffer(zip) || zip.length < 22) throw new PackageError("zip", "not a zip file");
  const end = findEnd(zip);
  if (zip.readUInt16LE(end + 4) !== 0 || zip.readUInt16LE(end + 6) !== 0) throw new PackageError("zip", "multi-disk zips are not supported");
  const count = zip.readUInt16LE(end + 10);
  const size = zip.readUInt32LE(end + 12);
  let at = zip.readUInt32LE(end + 16);
  if (count === 0xffff || at === 0xffffffff) throw new PackageError("zip", "zip64 is not supported");
  if (count > maxFiles) throw new PackageError("too-many-files", `more than ${maxFiles} files`);
  if (at + size > end) throw new PackageError("zip", "broken zip directory");
  const entries = [];
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > end || zip.readUInt32LE(at) !== CENTRAL) throw new PackageError("zip", "broken zip directory");
    const madeBy = zip.readUInt16LE(at + 4);
    const flags = zip.readUInt16LE(at + 8);
    const method = zip.readUInt16LE(at + 10);
    const crc = zip.readUInt32LE(at + 16);
    const compressedSize = zip.readUInt32LE(at + 20);
    const declared = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const external = zip.readUInt32LE(at + 38);
    const local = zip.readUInt32LE(at + 42);
    const nameBytes = zip.subarray(at + 46, at + 46 + nameLength);
    let path;
    try {
      path = decoder.decode(nameBytes);
    } catch {
      throw new PackageError("path", "a file name is not UTF-8");
    }
    at += 46 + nameLength + extraLength + commentLength;
    if (flags & 0x1) throw new PackageError("zip", "encrypted entries are not allowed", path);
    const kind = entryKind(madeBy, external, path);
    if (kind === "symlink") throw new PackageError("symlink", "symbolic links are not allowed", path);
    if (kind === "special") throw new PackageError("special", "only regular files are allowed", path);
    if (kind === "directory") continue;
    if (method !== 0 && method !== 8) throw new PackageError("zip", `compression method ${method} is not supported`, path);
    total += declared;
    if (total > maxUnpackedBytes) throw new PackageError("too-large", `unpacks to more than ${maxUnpackedBytes} bytes`);
    if (local + 30 > zip.length || zip.readUInt32LE(local) !== LOCAL) throw new PackageError("zip", "broken local header", path);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    if (start + compressedSize > zip.length) throw new PackageError("zip", "entry runs past the end of the file", path);
    const stored = zip.subarray(start, start + compressedSize);
    let data;
    try {
      data = method === 8 ? inflateRawSync(stored, { maxOutputLength: Math.max(declared, 1) }) : Buffer.from(stored);
    } catch {
      throw new PackageError("too-large", "entry is larger than it says or is corrupt", path);
    }
    if (data.length !== declared || crc32(data) !== crc) throw new PackageError("zip", "entry size or checksum does not match", path);
    entries.push({ path, data });
  }
  return entries;
}
