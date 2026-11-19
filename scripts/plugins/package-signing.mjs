import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { signingDir } from "../signing-dir.mjs";
import { dpapi, keyIdOf, rawPublicKey } from "./plugin-signing.mjs";

export const SIGNATURE_DOMAIN = "focusd-plugin-package/1";
export const AUTHOR_KEY_PATH = "plugins/author-key.json";
export const AUTHOR_KEY_FILE = path.join(signingDir(), "plugin-author-signing.key");
export const AUTHOR_KEY_ENV = "FUYU_PLUGIN_AUTHOR_KEY";
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

export const signedText = (id, version, digest) => `${SIGNATURE_DOMAIN}\n${id}\n${version}\n${digest.toLowerCase()}`;

export function publicKeyOf(privateKey) {
  const raw = rawPublicKey(createPublicKey(privateKey));
  return { keyId: keyIdOf(raw), publicKey: raw.toString("base64") };
}

export function signPackage(id, version, zip, privateKey) {
  const { keyId } = publicKeyOf(privateKey);
  return { keyId, signature: sign(null, Buffer.from(signedText(id, version, sha256(zip))), privateKey).toString("base64") };
}

export function verifyPackage(id, version, digest, signature, keys) {
  const key = keys.find((item) => item.keyId === signature?.keyId);
  if (!key || typeof signature.signature !== "string") return null;
  const raw = Buffer.from(key.publicKey, "base64");
  if (raw.length !== 32 || keyIdOf(raw) !== key.keyId) return null;
  const publicKey = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
  const ok = verify(null, Buffer.from(signedText(id, version, digest)), publicKey, Buffer.from(signature.signature, "base64"));
  return ok ? key.keyId : null;
}

export function packageNameParts(fileName) {
  const match = /^(.+)-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.zip$/.exec(path.basename(fileName));
  return match ? { id: match[1], version: match[2] } : null;
}

export function loadAuthorKey(root, env = process.env, file = AUTHOR_KEY_FILE) {
  let key;
  if (env[AUTHOR_KEY_ENV]?.trim()) {
    key = createPrivateKey(env[AUTHOR_KEY_ENV]);
  } else {
    if (!existsSync(file)) throw new Error(`No official author key at ${file}; set ${AUTHOR_KEY_ENV} instead.`);
    const stored = readFileSync(file, "utf8").trim();
    key = createPrivateKey(process.platform === "win32" ? dpapi("Unprotect", Buffer.from(stored, "base64")).toString("utf8") : stored);
  }
  const expected = JSON.parse(readFileSync(path.join(root, AUTHOR_KEY_PATH), "utf8"));
  if (publicKeyOf(key).keyId !== expected.keyId) throw new Error(`The official author key is not ${expected.keyId} (${AUTHOR_KEY_PATH}).`);
  return key;
}

export function writePackageSignature(zipFile, privateKey) {
  const parts = packageNameParts(zipFile);
  if (!parts) throw new Error(`${path.basename(zipFile)} is not named <id>-<version>.zip.`);
  const signature = signPackage(parts.id, parts.version, readFileSync(zipFile), privateKey);
  writeFileSync(`${zipFile}.sig`, `${JSON.stringify(signature, null, 2)}\n`);
  return signature;
}
