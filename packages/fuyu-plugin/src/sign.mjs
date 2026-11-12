import { spawnSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const SIGNATURE_DOMAIN = "focusd-plugin-package/1";
const KEY_FILE = path.join(homedir(), ".fuyu-plugin", "signing.key");
const LEGACY_KEY_FILE = path.join(homedir(), ".fly-island-plugin", "signing.key");
export const DEFAULT_KEY_FILE = existsSync(KEY_FILE) || !existsSync(LEGACY_KEY_FILE) ? KEY_FILE : LEGACY_KEY_FILE;
export const KEY_ENV = "FUYU_PLUGIN_SIGNING_KEY";
export const LEGACY_KEY_ENV = "FLY_ISLAND_PLUGIN_SIGNING_KEY";

export function keyEnvName(env, envName = KEY_ENV) {
  if (env[envName]?.trim()) return envName;
  return envName === KEY_ENV && env[LEGACY_KEY_ENV]?.trim() ? LEGACY_KEY_ENV : null;
}
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const signedText = (id, version, sha256) => `${SIGNATURE_DOMAIN}\n${id}\n${version}\n${sha256.toLowerCase()}`;

export const keyIdOf = (raw) => createHash("sha256").update(raw).digest("hex").slice(0, 16);

export function publicKeyOf(privateKey) {
  const raw = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(SPKI_PREFIX.length);
  return { keyId: keyIdOf(raw), publicKey: raw.toString("base64") };
}

export const sha256Hex = (buffer) => createHash("sha256").update(buffer).digest("hex");

export function signPackage(id, version, zip, privateKey) {
  const { keyId } = publicKeyOf(privateKey);
  return { keyId, signature: sign(null, Buffer.from(signedText(id, version, sha256Hex(zip))), privateKey).toString("base64") };
}

function verifyText(text, signature, keys) {
  const key = keys.find((item) => item.keyId === signature?.keyId);
  if (!key || typeof signature.signature !== "string") return null;
  const raw = Buffer.from(key.publicKey, "base64");
  if (raw.length !== 32 || keyIdOf(raw) !== key.keyId) return null;
  const publicKey = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
  return verify(null, Buffer.from(text), publicKey, Buffer.from(signature.signature, "base64")) ? key.keyId : null;
}

export function verifyPackage(id, version, sha256, signature, keys) {
  return verifyText(signedText(id, version, sha256), signature, keys);
}

export const KEY_DOMAIN = "focusd-plugin-key/1";

export const endorsementText = (id, key) => `${KEY_DOMAIN}\n${id}\n${key.keyId}\n${key.publicKey}`;

export function endorseKey(id, newKey, oldPrivateKey) {
  const { keyId } = publicKeyOf(oldPrivateKey);
  const signature = sign(null, Buffer.from(endorsementText(id, newKey)), oldPrivateKey).toString("base64");
  return { keyId: newKey.keyId, publicKey: newKey.publicKey, endorsedBy: { keyId, signature } };
}

export function verifyEndorsement(id, key, keys) {
  return Boolean(key?.endorsedBy) && verifyText(endorsementText(id, key), key.endorsedBy, keys) !== null;
}

function dpapi(mode, input) {
  const command = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$data = [Convert]::FromBase64String($env:FLY_ISLAND_DPAPI_INPUT)
$out = [Security.Cryptography.ProtectedData]::${mode}($data, $null, 'CurrentUser')
[Console]::Out.Write([Convert]::ToBase64String($out))`;
  const env = { ...process.env, FLY_ISLAND_DPAPI_INPUT: input.toString("base64") };
  delete env.PSModulePath;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", windowsHide: true, env });
  if (result.error || result.status !== 0) {
    throw new Error(`DPAPI ${mode} failed. Run as the Windows user who created the key, or set ${KEY_ENV}.`);
  }
  return Buffer.from(result.stdout.trim(), "base64");
}

export function loadSigningKey({ file = DEFAULT_KEY_FILE, env = process.env, envName = KEY_ENV } = {}) {
  const fromEnv = keyEnvName(env, envName);
  if (fromEnv) return createPrivateKey(env[fromEnv]);
  if (!existsSync(file)) throw new Error(`No signing key: run "fuyu-plugin keygen" once, or set ${envName}.`);
  const stored = readFileSync(file, "utf8").trim();
  const pem = process.platform === "win32" ? dpapi("Unprotect", Buffer.from(stored, "base64")).toString("utf8") : stored;
  return createPrivateKey(pem);
}

export function generateSigningKey(file = DEFAULT_KEY_FILE) {
  if (existsSync(file)) throw new Error(`${file} already exists. Delete it first only if you mean to replace the key.`);
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  mkdirSync(path.dirname(file), { recursive: true });
  if (process.platform === "win32") {
    writeFileSync(file, dpapi("Protect", Buffer.from(pem, "utf8")).toString("base64"));
  } else {
    writeFileSync(file, pem, { mode: 0o600 });
    chmodSync(file, 0o600);
  }
  return publicKeyOf(privateKey);
}

export function writePackageSignature(zipFile, id, version, zip, privateKey) {
  const signature = signPackage(id, version, zip, privateKey);
  writeFileSync(`${zipFile}.sig`, `${JSON.stringify(signature, null, 2)}\n`);
  return signature;
}

export function parsePackageName(fileName) {
  const match = /^(.+)-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.zip$/.exec(path.basename(fileName));
  return match ? { id: match[1], version: match[2] } : null;
}
