import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { signingDir } from "../signing-dir.mjs";
import { createCertificate } from "./self-signed-cert.mjs";

export const DEV_IDENTITY = "Fuyu Development Code Signing";
export const DEV_IDENTIFIER = "com.tixxin.fuyu.dev";

export const devSigningDir = (base = signingDir()) => path.join(base, "macos-dev");

export function devKeychainFiles(dir) {
  return {
    keychain: path.join(dir, "fuyu-dev.keychain-db"),
    password: path.join(dir, "fuyu-dev.keychain-password"),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed: ${(result.stderr || result.stdout || "").trim()}`);
  return `${result.stdout}${result.stderr}`;
}

export function parseSha1Fingerprint(text) {
  const match = /Fingerprint=([0-9A-Fa-f:]+)/.exec(text);
  if (!match) throw new Error("no SHA-1 fingerprint in the openssl output");
  return match[1].replaceAll(":", "").toUpperCase();
}

export function signedByDevIdentity(codesignDetails) {
  return codesignDetails.includes(`Authority=${DEV_IDENTITY}`) && codesignDetails.includes(`Identifier=${DEV_IDENTIFIER}`);
}

function createKeychain(files, certificate) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(files.password, `${password}\n`, { mode: 0o600 });
  try {
    run("security", ["create-keychain", "-p", password, files.keychain]);
    run("security", ["set-keychain-settings", files.keychain]);
    run("security", ["unlock-keychain", "-p", password, files.keychain]);
    const p12Password = readFileSync(certificate.password, "utf8").trim();
    run("security", ["import", certificate.p12, "-k", files.keychain, "-P", p12Password, "-T", "/usr/bin/codesign"]);
    run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:", "-s", "-k", password, files.keychain]);
  } catch (error) {
    rmSync(files.keychain, { force: true });
    rmSync(files.password, { force: true });
    throw error;
  }
}

export function ensureDevIdentity(dir = devSigningDir()) {
  const { files: certificate } = createCertificate(dir, DEV_IDENTITY);
  const files = devKeychainFiles(dir);
  if (!existsSync(files.keychain) || !existsSync(files.password)) createKeychain(files, certificate);
  run("security", ["unlock-keychain", "-p", readFileSync(files.password, "utf8").trim(), files.keychain]);
  const sha1 = parseSha1Fingerprint(run("openssl", ["x509", "-in", certificate.pem, "-noout", "-fingerprint", "-sha1"]));
  return { keychain: files.keychain, sha1 };
}

function codesignDetails(binary) {
  const result = spawnSync("codesign", ["-d", "--verbose=2", binary], { encoding: "utf8" });
  return result.status === 0 ? `${result.stdout}${result.stderr}` : "";
}

export function cargoOriginal(binary) {
  const deps = path.join(path.dirname(binary), "deps");
  if (!existsSync(deps)) return null;
  const { size } = statSync(binary);
  const pattern = new RegExp(`^${path.basename(binary)}-[0-9a-f]{16}$`);
  const candidates = readdirSync(deps)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(deps, name))
    .filter((file) => statSync(file).size === size);
  if (candidates.length === 0) return null;
  const content = readFileSync(binary);
  return candidates.find((file) => readFileSync(file).equals(content)) ?? null;
}

export function signDevBinary(binary, dir = devSigningDir()) {
  if (!existsSync(binary)) return { signed: false, message: `${binary} is missing` };
  if (signedByDevIdentity(codesignDetails(binary))) return { signed: false, message: "already signed" };
  const { keychain, sha1 } = ensureDevIdentity(dir);
  const original = cargoOriginal(binary);
  run("codesign", ["--force", "--sign", sha1, "--keychain", keychain, "--identifier", DEV_IDENTIFIER, original ?? binary]);
  if (original) {
    copyFileSync(original, binary);
    chmodSync(binary, statSync(original).mode);
  }
  return { signed: true, message: `signed ${binary} as ${DEV_IDENTIFIER}` };
}
