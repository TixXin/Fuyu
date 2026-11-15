import { resolve } from "node:path";
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

export async function prepareReleaseResources() {
  const { bundleHost } = await import("./bundle-host.mjs");
  const { buildBuiltins } = await import("./build-builtins.mjs");
  const host = await bundleHost();
  const builtins = await buildBuiltins();
  return { host: host.outDir, builtins: builtins.outDir, plugins: builtins.plugins };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--overlay")) {
    process.stdout.write(JSON.stringify(resourcesOverlay()));
  } else {
    const built = await prepareReleaseResources();
    console.log(`release resources: host in ${built.host}, built-in plugins (${built.plugins.join(", ") || "none"}) in ${built.builtins}`);
  }
}
