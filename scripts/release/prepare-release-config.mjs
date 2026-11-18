import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { prepareReleaseResources, releaseResources } from "../plugins-v3/release-resources.mjs";

const TARGET = "src-tauri/tauri.release.conf.json";

export function localReleaseOverlay(base, env = process.env) {
  const pubkey = (env.TAURI_UPDATER_PUBKEY ?? "").trim();
  if (!pubkey) {
    throw new Error(
      "TAURI_UPDATER_PUBKEY is missing.\n" +
        "Generate a key pair once with `pnpm tauri signer generate -w <path>`, then export the public key:\n" +
        "  TAURI_UPDATER_PUBKEY=$(cat <path>.pub)",
    );
  }

  const shippedKey = (base.plugins?.updater?.pubkey ?? "").trim();
  if (shippedKey && shippedKey !== pubkey) {
    throw new Error(
      "TAURI_UPDATER_PUBKEY does not match plugins.updater.pubkey in src-tauri/tauri.conf.json.\n" +
        "Installed builds trust only the shipped key and would reject this release.",
    );
  }

  const overlay = {
    plugins: {
      updater: {
        pubkey,
      },
    },
    bundle: {
      createUpdaterArtifacts: true,
      resources: releaseResources(),
    },
  };

  const endpoints = (env.TAURI_UPDATER_ENDPOINTS ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (endpoints.length > 0) {
    const insecure = endpoints.filter((entry) => !entry.startsWith("https://"));
    if (insecure.length > 0) {
      throw new Error(`Updater endpoints must use https:\n  ${insecure.join("\n  ")}`);
    }
    overlay.plugins.updater.endpoints = endpoints;
  }

  const version = env.TAURI_RELEASE_VERSION?.trim();
  if (version) {
    overlay.version = version;
  }

  return overlay;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const base = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
    const overlay = localReleaseOverlay(base, process.env);
    await prepareReleaseResources();
    writeFileSync(TARGET, `${JSON.stringify(overlay, null, 2)}\n`);
    console.log(`Wrote ${TARGET} for v${overlay.version ?? base.version}`);
    if (!overlay.plugins.updater.endpoints?.length) {
      console.log("Endpoints: inherited from src-tauri/tauri.conf.json");
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
