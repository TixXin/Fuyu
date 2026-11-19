import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createZip, executableKind, packDirectory, packFiles, packageDigest, packageFileName, readPackage } from "@fuyu/plugin-manifest";
import { samplePackage } from "./fixtures.mjs";

const manifestFile = { path: "package.json", data: Buffer.from(JSON.stringify(samplePackage(), null, 2)) };
const goodFiles = () => [
  manifestFile,
  { path: "dist/host.js", data: Buffer.from("export default {};\r\nconsole.log(1);\r\n") },
  { path: "assets/icon.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x0d, 0x0a]) },
  { path: "README.md", data: Buffer.from("# Weather\n") },
];
const rawZip = (entries) => createZip(entries.map(({ path, data }) => ({ path, data: Buffer.from(data) })));
const rejects = (action, code) => assert.throws(action, (error) => error.name === "PackageError" && error.code === code, `expected ${code}`);

test("packing is deterministic: sorted paths, fixed timestamps, LF text, binary untouched", () => {
  const first = packFiles(goodFiles());
  const second = packFiles(goodFiles().reverse());
  assert.ok(first.zip.equals(second.zip));
  assert.equal(first.digest, second.digest);
  const read = readPackage(first.zip);
  assert.deepEqual(read.files.map((file) => file.path), ["README.md", "assets/icon.png", "dist/host.js", "package.json"]);
  assert.equal(read.files.find((file) => file.path === "dist/host.js").data.toString(), "export default {};\nconsole.log(1);\n");
  assert.deepEqual([...read.files.find((file) => file.path === "assets/icon.png").data], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x0d, 0x0a]);
  assert.equal(read.manifest.name, "@someone/fuyu-weather");
  assert.equal(read.digest, first.digest);
  assert.equal(read.signatures, null);
});

test("the digest covers paths and contents but not the signature file", () => {
  const base = packFiles(goodFiles()).digest;
  const renamed = goodFiles().map((file) => (file.path === "README.md" ? { ...file, path: "README.zh-CN.md" } : file));
  assert.notEqual(packFiles(renamed).digest, base);
  const changed = goodFiles().map((file) => (file.path === "README.md" ? { ...file, data: Buffer.from("# Weather!\n") } : file));
  assert.notEqual(packFiles(changed).digest, base);
  assert.equal(packageDigest([...goodFiles(), { path: "fuyu-signature.json", data: Buffer.from("{}") }]), packageDigest(goodFiles()));
  assert.notEqual(packageDigest(goodFiles(), { namespace: "atoll" }), packageDigest(goodFiles()));
});

test("pack refuses forbidden paths and files", () => {
  const cases = [
    ["../evil.js", "path"],
    ["/etc/passwd", "path"],
    ["C:/evil.js", "path"],
    ["dist\\evil.js", "path"],
    ["dist/./x.js", "path"],
    ["dist/a\nb.js", "path"],
    ["node_modules/left-pad/index.js", "node-modules"],
    ["dist/Node_Modules/x.js", "node-modules"],
    ["dist/addon.node", "native"],
    ["bin/tool.exe", "executable"],
    ["lib/libx.dylib", "executable"],
    ["dist/engine.wasm", "executable"],
    ["lib/tool.JAR", "executable"],
    ["lib/Main.class", "executable"],
  ];
  for (const [path, code] of cases) rejects(() => packFiles([...goodFiles(), { path, data: Buffer.from("x") }]), code);
  rejects(() => packFiles([...goodFiles(), { path: "readme.md", data: Buffer.from("x") }]), "duplicate");
  rejects(() => packFiles(goodFiles().filter((file) => file.path !== "package.json")), "manifest");
  rejects(() => packFiles([{ path: "package.json", data: Buffer.from("{oops") }]), "manifest");
});

test("pack and read find executables and compiled code by their header whatever the name", () => {
  const pe = Buffer.alloc(128);
  pe.write("MZ", 0, "latin1");
  pe.writeUInt32LE(64, 0x3c);
  pe.write("PE\0\0", 64, "latin1");
  const cases = [
    [pe, "PE"],
    [Buffer.from("MZ"), "PE"],
    [Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]), "ELF"],
    [Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 7, 0, 0, 1]), "Mach-O"],
    [Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 2]), "Mach-O"],
    [Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 0x41]), "Java class"],
    [Buffer.from([0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0]), "WebAssembly"],
    [createZip([{ path: "META-INF/MANIFEST.MF", data: Buffer.from("Manifest-Version: 1.0\n") }]), "Java archive"],
    [createZip([{ path: "com/example/Main.class", data: Buffer.from([0xca, 0xfe, 0xba, 0xbe]) }]), "Java archive"],
  ];
  for (const [data, kind] of cases) {
    assert.equal(executableKind(data), kind);
    rejects(() => packFiles([...goodFiles(), { path: "assets/sound.mp3", data }]), "executable");
    rejects(() => readPackage(rawZip([manifestFile, { path: "assets/sound.mp3", data }])), "executable");
  }
  assert.equal(executableKind(Buffer.from("Mz is not MZ")), null);
  const plainZip = createZip([{ path: "data.json", data: Buffer.from("{}") }]);
  assert.equal(executableKind(plainZip), null);
  assert.doesNotThrow(() => packFiles([...goodFiles(), { path: "assets/data.zip", data: plainZip }]));
});

test("the package size limit is 20 MB by default and configurable", () => {
  const noise = randomBytes(64 * 1024);
  rejects(() => packFiles([...goodFiles(), { path: "assets/noise.bin.dat", data: noise }], { maxPackageBytes: 32 * 1024 }), "too-large");
  const big = packFiles([...goodFiles(), { path: "assets/noise.dat", data: noise }]).zip;
  rejects(() => readPackage(big, { maxPackageBytes: 32 * 1024 }), "too-large");
  rejects(() => readPackage(Buffer.alloc(20 * 1024 * 1024 + 1)), "too-large");
});

test("reading refuses bad packages the packer would never write", () => {
  for (const [path, code] of [["../x.js", "path"], ["/x.js", "path"], ["node_modules/a.js", "node-modules"], ["a.node", "native"]]) {
    rejects(() => readPackage(rawZip([manifestFile, { path, data: "x" }])), code);
  }
  rejects(() => readPackage(rawZip([manifestFile, { path: "a.js", data: "1" }, { path: "a.js", data: "2" }])), "duplicate");
  rejects(() => readPackage(rawZip([{ path: "x.js", data: "1" }])), "manifest");
  rejects(() => readPackage(Buffer.from("not a zip at all, just some text padding it out")), "zip");
});

test("reading refuses symbolic links and encrypted entries", () => {
  const zip = rawZip([manifestFile, { path: "link", data: "/etc/passwd" }]);
  const central = zip.indexOf(Buffer.from("PK\u0001\u0002", "latin1"), 0);
  const second = zip.indexOf(Buffer.from("PK\u0001\u0002", "latin1"), central + 4);
  const symlink = Buffer.from(zip);
  symlink.writeUInt32LE((0o120777 << 16) >>> 0, second + 38);
  rejects(() => readPackage(symlink), "symlink");
  const encrypted = Buffer.from(zip);
  encrypted.writeUInt16LE(encrypted.readUInt16LE(second + 8) | 1, second + 8);
  rejects(() => readPackage(encrypted), "zip");
});

test("reading stops zip bombs: total size, file count and lying sizes", () => {
  const zeros = Buffer.alloc(512 * 1024);
  const bomb = rawZip([manifestFile, { path: "a.dat", data: zeros }, { path: "b.dat", data: zeros }]);
  assert.ok(bomb.length < 10 * 1024);
  rejects(() => readPackage(bomb, { maxUnpackedBytes: 768 * 1024 }), "too-large");
  const many = rawZip([manifestFile, ...Array.from({ length: 20 }, (_, index) => ({ path: `f${index}.txt`, data: "x" }))]);
  rejects(() => readPackage(many, { maxFiles: 10 }), "too-many-files");
  const lying = Buffer.from(rawZip([manifestFile, { path: "a.dat", data: zeros }]));
  const central = lying.indexOf(Buffer.from("PK\u0001\u0002", "latin1"));
  const second = lying.indexOf(Buffer.from("PK\u0001\u0002", "latin1"), central + 4);
  lying.writeUInt32LE(10, second + 24);
  rejects(() => readPackage(lying), "too-large");
  const corrupt = Buffer.from(rawZip([manifestFile, { path: "a.txt", data: "hello" }]));
  const first = corrupt.indexOf(Buffer.from("PK\u0001\u0002", "latin1"));
  const entry = corrupt.indexOf(Buffer.from("PK\u0001\u0002", "latin1"), first + 4);
  corrupt.writeUInt32LE(0, entry + 16);
  rejects(() => readPackage(corrupt), "zip");
});

test("packDirectory packs a folder and refuses symbolic links", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "plugin-manifest-"));
  try {
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "package.json"), manifestFile.data);
    writeFileSync(join(dir, "dist", "host.js"), "export default {};\r\n");
    const packed = packDirectory(dir);
    assert.deepEqual(packed.files.map((file) => file.path), ["dist/host.js", "package.json"]);
    assert.equal(packed.files[0].data.toString(), "export default {};\n");
    try {
      symlinkSync(join(dir, "package.json"), join(dir, "dist", "link.json"));
    } catch (error) {
      if (error.code !== "EPERM") throw error;
      t.skip("creating symbolic links needs Developer Mode or admin rights");
      return;
    }
    rejects(() => packDirectory(dir), "symlink");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("package file names use the configurable extension", () => {
  assert.equal(packageFileName("@someone/fuyu-weather", "1.2.0"), "someone-fuyu-weather-1.2.0.fuyu");
  assert.equal(packageFileName("@someone/weather", "1.0.0", { namespace: "atoll" }), "someone-weather-1.0.0.atoll");
  assert.equal(packageFileName("@someone/weather", "1.0.0", { extension: ".plugin" }), "someone-weather-1.0.0.plugin");
});
