import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { executableKind, review } from "../src/index.mjs";

const clean = fileURLToPath(new URL("./fixtures/weather-1.0.0", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "plugin-review-exe-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function zipWith(...names) {
  return Buffer.concat(
    names.map((name) => {
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(Buffer.byteLength(name), 26);
      return Buffer.concat([header, Buffer.from(name)]);
    }),
  );
}

function classFile(major) {
  const data = Buffer.alloc(16);
  data.writeUInt32BE(0xcafebabe, 0);
  data.writeUInt16BE(0, 4);
  data.writeUInt16BE(major, 6);
  return data;
}

function fatMachO() {
  const data = Buffer.alloc(16);
  data.writeUInt32BE(0xcafebabe, 0);
  data.writeUInt32BE(2, 4);
  return data;
}

test("executableKind follows the @fuyu/plugin-manifest rules", () => {
  assert.equal(executableKind(Buffer.from("MZ")), "PE");
  assert.equal(executableKind(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2])), "ELF");
  assert.equal(executableKind(classFile(52)), "Java class");
  assert.equal(executableKind(classFile(45)), "Java class");
  assert.equal(executableKind(fatMachO()), "Mach-O");
  assert.equal(executableKind(Buffer.from([0xcf, 0xfa, 0xed, 0xfe])), "Mach-O");
  assert.equal(executableKind(Buffer.from([0xca, 0xfe, 0xba, 0xbf])), "Mach-O");
  assert.equal(executableKind(Buffer.from([0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0])), "WebAssembly");
  assert.equal(executableKind(zipWith("META-INF/MANIFEST.MF")), "Java archive");
  assert.equal(executableKind(zipWith("readme.txt", "com/evil/Main.class")), "Java archive");
  assert.equal(executableKind(zipWith("readme.txt", "icon.png")), null);
  assert.equal(executableKind(Buffer.from("export {};\n")), null);
});

function reviewWith(name, files) {
  const dir = join(scratch, name);
  cpSync(clean, dir, { recursive: true });
  for (const [path, data] of Object.entries(files)) writeFileSync(join(dir, path), data);
  return review({ oldDir: clean, newDir: dir });
}

const red = (report, file) => report.findings.find((f) => f.tier === "red" && f.check === "files" && f.file === file);

test("compiled code is red even with an innocent extension", () => {
  const cases = {
    "class-renamed": ["data.txt", classFile(52), "Java class"],
    "jar-renamed": ["fonts.dat", zipWith("META-INF/MANIFEST.MF", "a/B.class"), "Java archive"],
    "fat-macho": ["helper", fatMachO(), "Mach-O"],
    "class-by-extension": ["Main.class", Buffer.from("not really a class"), ".class"],
    "jar-by-extension": ["lib.jar", Buffer.from("plain text"), ".jar"],
  };
  for (const [name, [file, data, label]] of Object.entries(cases)) {
    const report = reviewWith(name, { [file]: data });
    assert.equal(report.tier, "red", name);
    assert.match(red(report, file)?.detail ?? "", new RegExp(`^${label.replace(".", "\\.")}，`), name);
    assert.ok(report.summary.binaries.some((b) => b.file === file && b.label === label), name);
  }
});

test("a zip without classes is a yellow binary, not an executable", () => {
  const report = reviewWith("plain-zip", { "assets.dat": zipWith("icon.png", "notes.txt") });
  assert.equal(report.tier, "yellow");
  assert.ok(!report.findings.some((f) => f.tier === "red"));
  assert.ok(report.findings.some((f) => f.check === "files" && f.file === "assets.dat"));
});
