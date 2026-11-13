import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { msiNames } from "./msi-version.mjs";

const REPO = "TixXin/fuyu";
const CONFIG = "src-tauri/tauri.conf.json";

const args = process.argv.slice(2);
const releaseFlag = args.indexOf("--release-dir");
const RELEASE_DIR = releaseFlag >= 0 ? args[releaseFlag + 1] : "src-tauri/target/release";
const BUNDLE_DIR = join(RELEASE_DIR, "bundle", "nsis");
const MSI_DIR = join(RELEASE_DIR, "bundle", "msi");
const notesFlag = args.indexOf("--notes-file");
const macFlag = args.indexOf("--mac-dir");
const MAC_DIR = macFlag >= 0 ? args[macFlag + 1] : "";
const baseFlag = args.indexOf("--base-url");
const baseUrl = baseFlag >= 0 ? args[baseFlag + 1]?.replace(/\/$/, "") : `https://github.com/${REPO}/releases/download/v${readVersion()}`;
if (!baseUrl || !URL.canParse(baseUrl) || new URL(baseUrl).protocol !== "https:") {
  console.error("--base-url requires a valid HTTPS URL.");
  process.exit(1);
}
const notesFile = notesFlag >= 0 ? args[notesFlag + 1] : `docs/releases/v${readVersion()}.md`;

function readVersion() {
  return JSON.parse(readFileSync(CONFIG, "utf8")).version;
}

const version = readVersion();

if (!existsSync(BUNDLE_DIR)) {
  console.error(`Missing ${BUNDLE_DIR}. Run "pnpm tauri build" first.`);
  process.exit(1);
}

const suffix = `_${version}_x64-setup.exe`;
const installer = readdirSync(BUNDLE_DIR).find((name) => name.endsWith(suffix));

if (!installer) {
  console.error(`Missing NSIS installer ending with ${suffix} in ${BUNDLE_DIR}.`);
  process.exit(1);
}

const signaturePath = join(BUNDLE_DIR, `${installer}.sig`);
if (!existsSync(signaturePath)) {
  console.error(`Missing ${signaturePath}. Build with TAURI_SIGNING_PRIVATE_KEY set so updater artifacts are signed.`);
  process.exit(1);
}

const notes = notesFile && existsSync(notesFile) ? readFileSync(notesFile, "utf8").trim() : "";
const msi = existsSync(MSI_DIR) && readdirSync(MSI_DIR).find((name) => msiNames(version).some((suffix) => name.endsWith(suffix)));
const msiSignaturePath = msi && join(MSI_DIR, `${msi}.sig`);
if (!msiSignaturePath || !existsSync(msiSignaturePath)) {
  console.error(`Missing signed MSI installer in ${MSI_DIR}. Build both nsis and msi release bundles first.`);
  process.exit(1);
}
const nsisTarget = {
  signature: readFileSync(signaturePath, "utf8").trim(),
  url: `${baseUrl}/${installer}`,
};

function macTarget() {
  if (!MAC_DIR) return null;
  const name = `Fuyu_${version}_aarch64.app.tar.gz`;
  const archive = join(MAC_DIR, name);
  const signature = `${archive}.sig`;
  if (!existsSync(archive) || !existsSync(signature)) {
    console.error(`Missing ${name} or its .sig in ${MAC_DIR}. Download the macOS build and sign it before writing the manifest.`);
    process.exit(1);
  }
  return { signature: readFileSync(signature, "utf8").trim(), url: `${baseUrl}/${name}` };
}

const mac = macTarget();

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  platforms: {
    "windows-x86_64": nsisTarget,
    "windows-x86_64-nsis": nsisTarget,
    "windows-x86_64-msi": {
      signature: readFileSync(msiSignaturePath, "utf8").trim(),
      url: `${baseUrl}/${msi}`,
    },
    ...(mac ? { "darwin-aarch64": mac, "darwin-aarch64-app": mac } : {}),
  },
};

const target = join(BUNDLE_DIR, "latest.json");
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${target}`);
console.log(`Upload these release assets:`);
console.log(`  ${join(BUNDLE_DIR, installer)}`);
console.log(`  ${signaturePath}`);
console.log(`  ${target}`);
