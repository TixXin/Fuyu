export const EXECUTABLE_EXTENSIONS = [
  ".exe", ".dll", ".sys", ".scr", ".com", ".msi", ".so", ".dylib", ".bin",
  ".elf", ".app", ".appimage", ".deb", ".rpm", ".pkg", ".dmg", ".wasm", ".jar", ".class",
];

const MACHO = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xbebafeca, 0xcafebabf, 0xbfbafeca]);
const isJarEntry = (name) => name === "META-INF/MANIFEST.MF" || name.toLowerCase().endsWith(".class");
const toBuffer = (data) => (Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength));

export function zipEntryNames(data) {
  const buf = toBuffer(data);
  const names = new Set();
  for (const [signature, nameAt, lengthAt] of [[Buffer.from([0x50, 0x4b, 0x03, 0x04]), 30, 26], [Buffer.from([0x50, 0x4b, 0x01, 0x02]), 46, 28]]) {
    for (let at = buf.indexOf(signature); at >= 0 && at + nameAt <= buf.length; at = buf.indexOf(signature, at + 4)) {
      const length = buf.readUInt16LE(at + lengthAt);
      if (at + nameAt + length <= buf.length) names.add(buf.toString("utf8", at + nameAt, at + nameAt + length));
    }
  }
  return [...names];
}

export function executableKind(data) {
  const buf = toBuffer(data);
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) return "PE";
  if (buf.length < 4) return null;
  const magic = buf.readUInt32BE(0);
  if (magic === 0x7f454c46) return "ELF";
  if (magic === 0xcafebabe) return buf.length >= 8 && buf.readUInt32BE(4) >= 45 ? "Java class" : "Mach-O";
  if (MACHO.has(magic)) return "Mach-O";
  if (magic === 0x0061736d) return "WebAssembly";
  if (magic === 0x504b0304 && zipEntryNames(buf).some(isJarEntry)) return "Java archive";
  return null;
}
