import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signingDir } from "../signing-dir.mjs";

export const IDENTITY = "Fuyu Self-Signed Code Signing";
export const SECRETS = ["MACOS_CERTIFICATE", "MACOS_CERTIFICATE_PASSWORD", "MACOS_SIGNING_IDENTITY"];
export const ENVIRONMENT = "release";
const REPO = "TixXin/fuyu";
const YEARS = 20;

export function certificateFiles(dir) {
  return {
    p12: path.join(dir, "fuyu-codesign.p12"),
    pem: path.join(dir, "fuyu-codesign.pem"),
    key: path.join(dir, "fuyu-codesign.key"),
    password: path.join(dir, "fuyu-codesign.password"),
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed: ${(result.stderr || result.stdout || "").trim()}`);
  return result.stdout;
}

export function createCertificate(dir) {
  const files = certificateFiles(dir);
  if (existsSync(files.p12) && existsSync(files.password)) return { files, created: false };
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const password = randomBytes(24).toString("hex");
  writeFileSync(files.password, `${password}\n`, { mode: 0o600 });
  run("openssl", [
    "req", "-x509", "-newkey", "rsa:3072", "-nodes", "-sha256",
    "-days", String(YEARS * 365),
    "-subj", `/CN=${IDENTITY}`,
    "-addext", "basicConstraints=critical,CA:false",
    "-addext", "keyUsage=critical,digitalSignature",
    "-addext", "extendedKeyUsage=critical,codeSigning",
    "-keyout", files.key, "-out", files.pem,
  ]);
  chmodSync(files.key, 0o600);
  run("openssl", [
    "pkcs12", "-export", "-name", IDENTITY,
    "-inkey", files.key, "-in", files.pem, "-out", files.p12,
    "-passout", `pass:${password}`,
  ]);
  chmodSync(files.p12, 0o600);
  return { files, created: true };
}

export function uploadSecrets(files, repo = REPO) {
  const password = readFileSync(files.password, "utf8").trim();
  const values = {
    MACOS_CERTIFICATE: readFileSync(files.p12).toString("base64"),
    MACOS_CERTIFICATE_PASSWORD: password,
    MACOS_SIGNING_IDENTITY: IDENTITY,
  };
  for (const name of SECRETS) {
    run("gh", ["secret", "set", name, "--repo", repo, "--env", ENVIRONMENT], { input: values[name] });
    console.log(`[self-signed-cert] set ${name} in the ${ENVIRONMENT} environment of ${repo}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dirFlag = process.argv.indexOf("--dir");
  const dir = dirFlag >= 0 ? process.argv[dirFlag + 1] : path.join(signingDir(), "macos");
  try {
    const { files, created } = createCertificate(dir);
    console.log(`[self-signed-cert] ${created ? "created" : "kept"} ${files.p12} (${IDENTITY})`);
    if (process.argv.includes("--upload")) uploadSecrets(files);
    else console.log("[self-signed-cert] run again with --upload to put it into the secrets of the release environment used by release-macos.yml");
  } catch (error) {
    console.error(`[self-signed-cert] ${error.message}`);
    process.exit(1);
  }
}
