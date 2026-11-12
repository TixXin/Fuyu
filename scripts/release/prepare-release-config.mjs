import { readFileSync, writeFileSync } from "node:fs";

const TARGET = "src-tauri/tauri.release.conf.json";

const pubkey = (process.env.TAURI_UPDATER_PUBKEY ?? "").trim();
if (!pubkey) {
  console.error(
    "TAURI_UPDATER_PUBKEY is missing.\n" +
      "Generate a key pair once with `pnpm tauri signer generate -w <path>`, then export the public key:\n" +
      "  TAURI_UPDATER_PUBKEY=$(cat <path>.pub)",
  );
  process.exit(1);
}

const base = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const shippedKey = (base.plugins?.updater?.pubkey ?? "").trim();
if (shippedKey && shippedKey !== pubkey) {
  console.error(
    "TAURI_UPDATER_PUBKEY does not match plugins.updater.pubkey in src-tauri/tauri.conf.json.\n" +
      "Installed builds trust only the shipped key and would reject this release.",
  );
  process.exit(1);
}

const overlay = {
  plugins: {
    updater: {
      pubkey,
    },
  },
  bundle: {
    createUpdaterArtifacts: true,
  },
};

const endpoints = (process.env.TAURI_UPDATER_ENDPOINTS ?? "")
  .split(/[\n,]/)
  .map((entry) => entry.trim())
  .filter(Boolean);

if (endpoints.length > 0) {
  const insecure = endpoints.filter((entry) => !entry.startsWith("https://"));
  if (insecure.length > 0) {
    console.error(`Updater endpoints must use https:\n  ${insecure.join("\n  ")}`);
    process.exit(1);
  }
  overlay.plugins.updater.endpoints = endpoints;
}

const version = process.env.TAURI_RELEASE_VERSION?.trim();
if (version) {
  overlay.version = version;
}

writeFileSync(TARGET, `${JSON.stringify(overlay, null, 2)}\n`);
console.log(`Wrote ${TARGET} for v${version ?? base.version}`);
if (!endpoints.length) {
  console.log("Endpoints: inherited from src-tauri/tauri.conf.json");
}
