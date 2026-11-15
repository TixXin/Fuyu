import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { PackageError, packFiles, readPackage, resolvePackageOptions } from "./package.mjs";

export const SIGNATURE_FORMAT = 1;
export const SIGNATURE_ROLES = ["author", "market"];
const SPKI_HEX = "302a300506032b6570032100";
const SPKI_PREFIX = Buffer.from(SPKI_HEX, "hex");
const HEX64 = /^[0-9a-f]{64}$/;

export const keyIdOf = (raw) => createHash("sha256").update(raw).digest("hex").slice(0, 16);

function toPrivateKey(key) {
  const object = typeof key === "string" || Buffer.isBuffer(key) ? createPrivateKey(key) : key;
  if (object?.asymmetricKeyType !== "ed25519") throw new TypeError("signing keys must be Ed25519 private keys");
  return object;
}

export function publicKeyOf(privateKey) {
  const raw = createPublicKey(toPrivateKey(privateKey)).export({ format: "der", type: "spki" }).subarray(SPKI_PREFIX.length);
  return { keyId: keyIdOf(raw), publicKey: raw.toString("base64") };
}

export function generateSigningKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return { privateKey, ...publicKeyOf(privateKey) };
}

function checkSubject({ role, name, version, digest }) {
  if (!SIGNATURE_ROLES.includes(role)) throw new TypeError(`role must be one of ${SIGNATURE_ROLES.join(", ")}`);
  for (const [key, value] of Object.entries({ name, version })) {
    if (typeof value !== "string" || value === "" || /[\n\r]/.test(value)) throw new TypeError(`${key} must be one line of text`);
  }
  if (typeof digest !== "string" || !HEX64.test(digest)) throw new TypeError("digest must be a lowercase SHA-256 hex string");
}

export function signatureText(subject, options = {}) {
  checkSubject(subject);
  const { namespace } = resolvePackageOptions(options);
  return `${namespace}-package-signature/1\n${subject.role}\n${subject.name}\n${subject.version}\n${subject.digest}`;
}

export function signDigest(subject, privateKey, options = {}) {
  const key = toPrivateKey(privateKey);
  const { keyId } = publicKeyOf(key);
  return { role: subject.role, keyId, signature: sign(null, Buffer.from(signatureText(subject, options)), key).toString("base64") };
}

export function verifyDigestSignature(entry, subject, keys, options = {}) {
  if (!entry || typeof entry.signature !== "string" || entry.role !== subject.role) return null;
  const key = (keys ?? []).find((item) => item.keyId === entry.keyId);
  if (!key || typeof key.publicKey !== "string") return null;
  const raw = Buffer.from(key.publicKey, "base64");
  if (raw.length !== 32 || keyIdOf(raw) !== key.keyId) return null;
  try {
    const publicKey = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
    return verify(null, Buffer.from(signatureText(subject, options)), publicKey, Buffer.from(entry.signature, "base64")) ? key.keyId : null;
  } catch {
    return null;
  }
}

export function signatureFileFor(manifest, digest, signatures = []) {
  return { format: SIGNATURE_FORMAT, name: manifest.name, version: manifest.version, digest, signatures };
}

function sameSubject(file, manifest, digest) {
  return file && file.format === SIGNATURE_FORMAT && file.name === manifest.name && file.version === manifest.version && file.digest === digest && Array.isArray(file.signatures);
}

export function signPackage(zip, role, privateKey, options = {}) {
  const settings = resolvePackageOptions(options);
  const { files, manifest, digest, signatures } = readPackage(zip, settings);
  const entry = signDigest({ role, name: manifest.name, version: manifest.version, digest }, privateKey, settings);
  const kept = sameSubject(signatures, manifest, digest) ? signatures.signatures.filter((item) => !(item.role === role && item.keyId === entry.keyId)) : [];
  const file = signatureFileFor(manifest, digest, [...kept, entry].sort((a, b) => SIGNATURE_ROLES.indexOf(a.role) - SIGNATURE_ROLES.indexOf(b.role) || (a.keyId < b.keyId ? -1 : 1)));
  const data = Buffer.from(`${JSON.stringify(file, null, 2)}\n`, "utf8");
  const packed = packFiles([...files, { path: settings.signatureFile, data }], { ...settings, normalizeText: false });
  if (packed.digest !== digest) throw new PackageError("signature", "signing changed the package digest");
  return packed.zip;
}

export function verifyPackage(zip, keys = {}, options = {}) {
  const settings = resolvePackageOptions(options);
  const { files, manifest, digest, signatures } = readPackage(zip, settings);
  const result = { manifest, digest, files, author: null, market: null, signed: signatures !== null, problems: [] };
  if (signatures === null) return result;
  if (!sameSubject(signatures, manifest, digest)) {
    result.problems.push("the signature file does not match this package's name, version or digest");
    return result;
  }
  const subject = { name: manifest.name, version: manifest.version, digest };
  for (const entry of signatures.signatures) {
    if (!SIGNATURE_ROLES.includes(entry?.role)) {
      result.problems.push(`unknown signature role ${JSON.stringify(entry?.role)}`);
      continue;
    }
    const keyId = verifyDigestSignature(entry, { ...subject, role: entry.role }, keys[entry.role], settings);
    if (keyId && !result[entry.role]) result[entry.role] = keyId;
    if (!keyId) result.problems.push(`${entry.role} signature ${entry.keyId ?? "?"} does not verify with the trusted keys`);
  }
  return result;
}
