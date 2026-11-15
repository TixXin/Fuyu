import { spawnSync } from "node:child_process";
import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { publicKeyOf } from "@fuyu/plugin-market";

export const KEY_ENV = "FUYU_PLUGIN_SIGNING_KEY";
export const LEGACY_KEY_ENV = "FLY_ISLAND_PLUGIN_SIGNING_KEY";

export function defaultKeyFile(home = homedir()) {
  const file = join(home, ".fuyu-plugin", "signing.key");
  const legacy = join(home, ".fly-island-plugin", "signing.key");
  return existsSync(file) || !existsSync(legacy) ? file : legacy;
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
  if (result.error || result.status !== 0) throw new Error(`DPAPI ${mode} failed. Run as the Windows user who created the key, or set ${KEY_ENV}.`);
  return Buffer.from(result.stdout.trim(), "base64");
}

function ed25519(pem, source) {
  let key;
  try {
    key = createPrivateKey(pem);
  } catch (error) {
    throw new Error(`${source} is not a private key: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (key.asymmetricKeyType !== "ed25519") throw new Error(`${source} is a ${key.asymmetricKeyType} key; signing keys are Ed25519`);
  return key;
}

export function loadSigningKey({ file, env = process.env, platform = process.platform, home } = {}) {
  if (!file) {
    const name = env[KEY_ENV]?.trim() ? KEY_ENV : env[LEGACY_KEY_ENV]?.trim() ? LEGACY_KEY_ENV : null;
    if (name) return { privateKey: ed25519(env[name], `$${name}`), source: `$${name}` };
  }
  const path = file ?? defaultKeyFile(home);
  if (!existsSync(path)) throw new Error(`No signing key at ${path}: run "fuyu-plugin keygen" once, or set ${KEY_ENV} to the PEM text.`);
  const stored = readFileSync(path, "utf8").trim();
  const pem = stored.startsWith("-----BEGIN") || platform !== "win32" ? stored : dpapi("Unprotect", Buffer.from(stored, "base64")).toString("utf8");
  return { privateKey: ed25519(pem, path), source: path };
}

export function generateSigningKey({ file, platform = process.platform, home } = {}) {
  const path = file ?? defaultKeyFile(home);
  if (existsSync(path)) throw Object.assign(new Error(`${path} already exists. Delete it first only if you mean to replace the key.`), { code: "exists", file: path });
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  mkdirSync(dirname(path), { recursive: true });
  if (platform === "win32") {
    writeFileSync(path, dpapi("Protect", Buffer.from(pem, "utf8")).toString("base64"));
  } else {
    writeFileSync(path, pem, { mode: 0o600 });
    chmodSync(path, 0o600);
  }
  return { ...publicKeyOf(privateKey), file: path };
}
