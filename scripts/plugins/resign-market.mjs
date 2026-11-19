import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAuthorKey, writePackageSignature } from "./package-signing.mjs";
import { loadPrivateKey, signIndex } from "./plugin-signing.mjs";

export const INDEX_PATH = "plugins/index.json";
export const REVOKED_PATH = "plugins/revoked.json";
export const PACKAGES_DIR = "plugins/packages";

function signFile(root, relative, check, privateKey) {
  const file = path.join(root, relative);
  const text = readFileSync(file, "utf8");
  const parsed = JSON.parse(text);
  if (parsed.version !== 1 || !Array.isArray(parsed[check])) throw new Error(`${relative} must be { "version": 1, "${check}": [...] }.`);
  writeFileSync(`${file}.sig`, `${JSON.stringify(signIndex(text, privateKey), null, 2)}\n`);
}

export function signPackages(root, loadKey) {
  const dir = path.join(root, PACKAGES_DIR);
  let key = null;
  const signed = [];
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".zip")).sort()) {
    const file = path.join(dir, name);
    if (existsSync(`${file}.sig`)) continue;
    key ??= loadKey();
    writePackageSignature(file, key);
    signed.push(name);
  }
  return signed;
}

export function resignMarket(root, privateKey = loadPrivateKey(), loadKey = () => loadAuthorKey(root)) {
  signFile(root, INDEX_PATH, "plugins", privateKey);
  signFile(root, REVOKED_PATH, "revoked", privateKey);
  return signPackages(root, loadKey);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const signed = resignMarket(root);
  console.log(`Re-signed ${INDEX_PATH} and ${REVOKED_PATH}${signed.length ? `; signed ${signed.join(", ")}` : ""}.`);
}
