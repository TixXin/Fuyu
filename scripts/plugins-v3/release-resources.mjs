import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_RESOURCES = Object.freeze({
  "target/plugins-v3/host": "plugins-v3/host",
  "target/plugins-v3/builtins": "plugins-v3/builtins",
});

export const SHIPPED_FILES = Object.freeze(["plugins-v3/host/main.mjs", "plugins-v3/builtins/builtins.json"]);

export function releaseResources() {
  return { ...RELEASE_RESOURCES };
}

export function resourcesOverlay() {
  return { bundle: { resources: releaseResources() } };
}

export function verifyShippedResources(rootDir) {
  for (const file of SHIPPED_FILES) {
    const target = join(rootDir, file);
    if (!existsSync(target)) throw new Error(`Missing shipped resource: ${target}`);
  }
}

export async function prepareReleaseResources() {
  const { bundleHost } = await import("./bundle-host.mjs");
  const { buildBuiltins } = await import("./build-builtins.mjs");
  const host = await bundleHost();
  const builtins = await buildBuiltins();
  return { host: host.outDir, builtins: builtins.outDir, plugins: builtins.plugins };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verifyIndex = process.argv.indexOf("--verify");
  if (process.argv.includes("--overlay")) {
    process.stdout.write(JSON.stringify(resourcesOverlay()));
  } else if (verifyIndex >= 0) {
    const dir = process.argv[verifyIndex + 1];
    if (!dir) {
      console.error("usage: node scripts/plugins-v3/release-resources.mjs --verify <dir>");
      process.exit(1);
    }
    try {
      verifyShippedResources(dir);
    } catch (error) {
      console.error(`::error::${error.message}`);
      process.exit(1);
    }
  } else {
    const built = await prepareReleaseResources();
    console.log(`release resources: host in ${built.host}, built-in plugins (${built.plugins.join(", ") || "none"}) in ${built.builtins}`);
  }
}
