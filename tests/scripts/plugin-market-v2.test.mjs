import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { packageNameParts, publicKeyOf, sha256, verifyPackage } from "../../scripts/plugins/package-signing.mjs";
import { keyIdOf, rawPublicKey, signIndex, verifyIndex } from "../../scripts/plugins/plugin-signing.mjs";
import { resignMarket } from "../../scripts/plugins/resign-market.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));

test("index signatures verify, survive CRLF and catch changes", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = rawPublicKey(publicKey);
  const trusted = [{ keyId: keyIdOf(raw), publicKey: raw.toString("base64") }];
  const text = '{\n  "version": 1\n}\n';
  const signature = signIndex(text, privateKey);
  assert.equal(signature.keyId, trusted[0].keyId);
  assert.equal(verifyIndex(text, signature, trusted), true);
  assert.equal(verifyIndex(text.replaceAll("\n", "\r\n"), signature, trusted), true);
  assert.equal(verifyIndex(text.replace("1", "2"), signature, trusted), false);
  assert.equal(verifyIndex(text, { ...signature, keyId: "other" }, trusted), false);
  assert.equal(verifyIndex(text, null, trusted), false);
});

test("the frozen index and revocation list are signed by the legacy index key, which the CI key list does not include", () => {
  const legacy = json("plugins/legacy-index-key.json").keys;
  const trusted = json("plugins/signing-keys.json").keys;
  for (const file of ["plugins/index.json", "plugins/revoked.json"]) {
    const signature = json(`${file}.sig`);
    assert.equal(verifyIndex(read(file), signature, legacy), true, `${file}: run pnpm plugins:resign`);
    assert.equal(verifyIndex(read(file), signature, trusted), false, file);
  }
});

test("every index entry points at a package in plugins/packages with the same hash and size", () => {
  const { version, plugins } = json("plugins/index.json");
  assert.equal(version, 1);
  assert.ok(plugins.length > 0);
  for (const entry of plugins) {
    const name = path.posix.basename(new URL(entry.download.url).pathname);
    assert.deepEqual(packageNameParts(name), { id: entry.id, version: entry.version }, name);
    const zip = readFileSync(path.join(root, "plugins/packages", name));
    assert.equal(entry.download.sha256, sha256(zip), name);
    assert.equal(entry.download.size, zip.length, name);
  }
});

test("every package in plugins/packages is signed by the official author key", () => {
  const key = json("plugins/author-key.json");
  const zips = readdirSync(path.join(root, "plugins/packages")).filter((name) => name.endsWith(".zip"));
  assert.ok(zips.length > 0);
  for (const name of zips) {
    const file = path.join(root, "plugins/packages", name);
    const { id, version } = packageNameParts(name);
    const signature = JSON.parse(readFileSync(`${file}.sig`, "utf8"));
    assert.equal(verifyPackage(id, version, sha256(readFileSync(file)), signature, [key]), key.keyId, name);
  }
});

test("resignMarket signs the index and revocation list as they are and signs only unsigned packages", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fuyu-market-"));
  try {
    mkdirSync(path.join(dir, "plugins/packages"), { recursive: true });
    cpSync(path.join(root, "plugins/index.json"), path.join(dir, "plugins/index.json"));
    cpSync(path.join(root, "plugins/revoked.json"), path.join(dir, "plugins/revoked.json"));
    writeFileSync(path.join(dir, "plugins/packages/dev.example.a-1.0.0.zip"), "a");
    writeFileSync(path.join(dir, "plugins/packages/dev.example.b-1.2.0.zip"), "b");
    writeFileSync(path.join(dir, "plugins/packages/dev.example.b-1.2.0.zip.sig"), "kept");
    const index = generateKeyPairSync("ed25519");
    const author = generateKeyPairSync("ed25519");
    const authorKey = publicKeyOf(author.privateKey);
    const signed = resignMarket(dir, index.privateKey, () => author.privateKey);

    assert.deepEqual(signed, ["dev.example.a-1.0.0.zip"]);
    assert.equal(readFileSync(path.join(dir, "plugins/index.json"), "utf8"), read("plugins/index.json"));
    const trusted = [publicKeyOf(index.privateKey)];
    for (const file of ["plugins/index.json", "plugins/revoked.json"]) {
      const signature = JSON.parse(readFileSync(path.join(dir, `${file}.sig`), "utf8"));
      assert.equal(verifyIndex(readFileSync(path.join(dir, file), "utf8"), signature, trusted), true, file);
    }
    const packageSignature = JSON.parse(readFileSync(path.join(dir, "plugins/packages/dev.example.a-1.0.0.zip.sig"), "utf8"));
    assert.equal(verifyPackage("dev.example.a", "1.0.0", sha256(Buffer.from("a")), packageSignature, [authorKey]), authorKey.keyId);
    assert.equal(readFileSync(path.join(dir, "plugins/packages/dev.example.b-1.2.0.zip.sig"), "utf8"), "kept");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resignMarket refuses an index that is not version 1 with a plugin list", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fuyu-market-"));
  try {
    mkdirSync(path.join(dir, "plugins/packages"), { recursive: true });
    writeFileSync(path.join(dir, "plugins/index.json"), '{ "version": 2, "plugins": [] }\n');
    writeFileSync(path.join(dir, "plugins/revoked.json"), '{ "version": 1, "revoked": [] }\n');
    const { privateKey } = generateKeyPairSync("ed25519");
    assert.throws(() => resignMarket(dir, privateKey, () => privateKey), /plugins\/index\.json must be/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
