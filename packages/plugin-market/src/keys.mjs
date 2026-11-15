import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const SPKI_PREFIX = Buffer.of(0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const signedBytes = (text) => Buffer.from(String(text).replaceAll("\r\n", "\n"), "utf8");

export const keyIdOf = (raw) => createHash("sha256").update(raw).digest("hex").slice(0, 16);

function rawBytes(publicKey) {
  if (typeof publicKey !== "string" || !BASE64.test(publicKey)) return null;
  const raw = Buffer.from(publicKey, "base64");
  return raw.length === 32 ? raw : null;
}

export function isPublicKeyEntry(value) {
  if (!value || typeof value !== "object") return false;
  const raw = rawBytes(value.publicKey);
  return raw !== null && value.keyId === keyIdOf(raw);
}

export function isSignatureObject(value) {
  return Boolean(value) && typeof value === "object" && typeof value.keyId === "string" && typeof value.signature === "string";
}

export function isSignatureFile(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every(isSignatureObject);
  return isSignatureObject(value);
}

const toPrivateKey = (key) => (typeof key === "string" ? createPrivateKey(key) : key);

export function publicKeyOf(privateKey) {
  const der = createPublicKey(toPrivateKey(privateKey)).export({ format: "der", type: "spki" });
  const raw = der.subarray(SPKI_PREFIX.length);
  return { keyId: keyIdOf(raw), publicKey: raw.toString("base64") };
}

export function signText(text, privateKey) {
  const key = toPrivateKey(privateKey);
  return { keyId: publicKeyOf(key).keyId, signature: sign(null, signedBytes(text), key).toString("base64") };
}

function verifyOne(bytes, signature, keys) {
  if (!isSignatureObject(signature)) return null;
  for (const key of keys) {
    if (key?.keyId !== signature.keyId || !isPublicKeyEntry(key)) continue;
    const publicKey = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, rawBytes(key.publicKey)]), format: "der", type: "spki" });
    try {
      if (verify(null, bytes, publicKey, Buffer.from(signature.signature, "base64"))) return key.keyId;
    } catch {
      return null;
    }
  }
  return null;
}

export function verifyText(text, signature, keys) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const bytes = signedBytes(text);
  const signatures = Array.isArray(signature) ? signature : [signature];
  for (const one of signatures) {
    const keyId = verifyOne(bytes, one, keys);
    if (keyId) return keyId;
  }
  return null;
}
