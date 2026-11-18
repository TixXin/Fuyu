#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { openRevoked, publicKeyOf, signText } from "../../packages/plugin-market/src/index.mjs";
import { DEFAULT_TRUST } from "../../src/features/updater/host/market.mjs";

export const REVOCATION_KEY_ENV = "FUYU_REVOCATION_V3_SIGNING_KEY";

export function defaultRevocationKeyFile(home = homedir()) {
  return join(home, ".tauri", "fuyu", "revocation-v3.key");
}

export function loadRevocationPrivateKey({ keyFile, env = process.env, home = homedir() } = {}) {
  if (!keyFile && env[REVOCATION_KEY_ENV]?.trim()) {
    return env[REVOCATION_KEY_ENV].trim();
  }
  const target = keyFile ? resolve(keyFile) : defaultRevocationKeyFile(home);
  if (!existsSync(target)) {
    throw new Error(`Revocation signing key not found at ${target}`);
  }
  return readFileSync(target, "utf8").trim();
}

export function signRevokedDocument(text, privateKeyPem, { trust = DEFAULT_TRUST, lastSerial, now = Date.now() } = {}) {
  const pub = publicKeyOf(privateKeyPem);
  const signature = signText(text, privateKeyPem);
  const opened = openRevoked({ text, signature, trust, lastSerial, now });
  if (opened.status !== "ok") {
    throw new Error(`Signed revoked.v3.json failed verification: ${opened.reason ?? opened.status}`);
  }
  return { signature, keyId: pub.keyId, doc: opened.doc };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      file: { type: "string" },
      key: { type: "string" },
      "last-serial": { type: "string" },
    },
  });
  const target = resolve(values.file ?? positionals[0] ?? "revoked.v3.json");
  const text = readFileSync(target, "utf8");
  const privateKey = loadRevocationPrivateKey({ keyFile: values.key });
  const lastSerial = values["last-serial"] !== undefined ? Number(values["last-serial"]) : undefined;
  const { signature, keyId, doc } = signRevokedDocument(text, privateKey, { lastSerial });
  const sigPath = `${target}.sig`;
  writeFileSync(sigPath, `${JSON.stringify(signature, null, 2)}\n`, "utf8");
  console.log(`Signed ${target} -> ${sigPath} with key ${keyId} (serial ${doc.serial}, expires ${doc.expires})`);
}
