import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { generateSigningKey, packFiles, publicKeyOf, readPackage, signDigest, signPackage, signatureText, verifyDigestSignature, verifyPackage } from "@fuyu/plugin-manifest";
import { samplePackage } from "./fixtures.mjs";

const files = () => [
  { path: "package.json", data: Buffer.from(JSON.stringify(samplePackage())) },
  { path: "dist/host.js", data: Buffer.from("export default {};\n") },
];
const author = generateSigningKey();
const market = generateSigningKey();
const trusted = { author: [author], market: [market] };

test("an unsigned package reads as unsigned", () => {
  const result = verifyPackage(packFiles(files()).zip, trusted);
  assert.equal(result.signed, false);
  assert.equal(result.author, null);
  assert.equal(result.market, null);
});

test("author and market signatures live in one file and keep the digest", () => {
  const { zip, digest } = packFiles(files());
  const authored = signPackage(zip, "author", author.privateKey);
  const both = signPackage(authored, "market", market.privateKey);
  const result = verifyPackage(both, trusted);
  assert.equal(result.digest, digest);
  assert.equal(result.author, author.keyId);
  assert.equal(result.market, market.keyId);
  assert.deepEqual(result.problems, []);
  const read = readPackage(both);
  assert.deepEqual(read.signatures.signatures.map((entry) => entry.role), ["author", "market"]);
  assert.equal(read.signatures.digest, digest);
  assert.ok(!read.files.some((file) => file.path === "fuyu-signature.json"));
  assert.ok(signPackage(authored, "author", author.privateKey).equals(authored));
});

test("signatures only verify with the trusted key of the same role", () => {
  const signed = signPackage(packFiles(files()).zip, "author", author.privateKey);
  assert.equal(verifyPackage(signed, { market: [author] }).author, null);
  assert.equal(verifyPackage(signed, { author: [market] }).author, null);
  const stranger = generateSigningKey();
  const result = verifyPackage(signPackage(packFiles(files()).zip, "author", stranger.privateKey), trusted);
  assert.equal(result.author, null);
  assert.equal(result.problems.length, 1);
});

test("a signature does not survive a change to the package", () => {
  const signed = readPackage(signPackage(packFiles(files()).zip, "author", author.privateKey));
  const changed = files().map((file) => (file.path === "dist/host.js" ? { ...file, data: Buffer.from("steal();\n") } : file));
  const signatureData = Buffer.from(JSON.stringify(signed.signatures));
  const tampered = packFiles([...changed, { path: "fuyu-signature.json", data: signatureData }]).zip;
  const result = verifyPackage(tampered, trusted);
  assert.equal(result.author, null);
  assert.match(result.problems[0], /does not match/);
  const forged = { ...signed.signatures, digest: packFiles(changed).digest };
  const forgedZip = packFiles([...changed, { path: "fuyu-signature.json", data: Buffer.from(JSON.stringify(forged)) }]).zip;
  assert.equal(verifyPackage(forgedZip, trusted).author, null);
});

test("the signed text has a domain prefix and role, so roles and namespaces do not mix", () => {
  const subject = { role: "author", name: "@someone/x", version: "1.0.0", digest: "a".repeat(64) };
  assert.equal(signatureText(subject), `fuyu-package-signature/1\nauthor\n@someone/x\n1.0.0\n${"a".repeat(64)}`);
  const entry = signDigest(subject, author.privateKey);
  assert.equal(verifyDigestSignature(entry, subject, [author]), author.keyId);
  assert.equal(verifyDigestSignature({ ...entry, role: "market" }, { ...subject, role: "market" }, [author]), null);
  assert.equal(verifyDigestSignature(entry, subject, [author], { namespace: "atoll" }), null);
  assert.throws(() => signatureText({ ...subject, name: "a\nb" }), TypeError);
  assert.throws(() => signatureText({ ...subject, role: "admin" }), TypeError);
  assert.throws(() => signatureText({ ...subject, digest: "xyz" }), TypeError);
});

test("keys use the v2 format: raw Ed25519 public key in base64, key id from its SHA-256", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  const fromPem = publicKeyOf(pem);
  assert.deepEqual(fromPem, publicKeyOf(privateKey));
  assert.equal(Buffer.from(fromPem.publicKey, "base64").length, 32);
  assert.match(fromPem.keyId, /^[0-9a-f]{16}$/);
  assert.throws(() => publicKeyOf(generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey), TypeError);
  assert.equal(verifyDigestSignature({ role: "author", keyId: author.keyId, signature: "x" }, { role: "author", name: "@a/b", version: "1.0.0", digest: "0".repeat(64) }, [{ keyId: author.keyId, publicKey: market.publicKey }]), null);
});

test("the signature file name and extension follow the namespace", () => {
  const zip = packFiles(files(), { namespace: "atoll" }).zip;
  const signed = signPackage(zip, "author", author.privateKey, { namespace: "atoll" });
  assert.ok(readPackage(signed, { namespace: "atoll" }).signatures);
  assert.equal(verifyPackage(signed, trusted, { namespace: "atoll" }).author, author.keyId);
  assert.equal(readPackage(signed).files.some((file) => file.path === "atoll-signature.json"), true);
});
