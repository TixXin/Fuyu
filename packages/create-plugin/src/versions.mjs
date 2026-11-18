import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export const ENGINE = ">=0.4.0";
export const SDK_VERSION = `^${SELF.version}`;

export const TOOLS = Object.freeze({
  "@types/react": "^19.1.8",
  eslint: "^10.14.0",
  typescript: "~5.8.3",
  "typescript-eslint": "^8.72.1",
});

export const FUYU_PACKAGES = Object.freeze({
  "@fuyu/plugin-base": "packages/plugin-base",
  "@fuyu/plugin-cli": "packages/plugin-cli",
  "@fuyu/plugin-services": "packages/plugin-services",
});

export const OWN_CHECKOUT = fileURLToPath(new URL("../../..", import.meta.url));

function packageName(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name;
  } catch {
    return null;
  }
}

export function isCheckout(dir) {
  return Object.entries(FUYU_PACKAGES).every(([name, path]) => packageName(join(dir, path)) === name);
}

export function findCheckout(given, options = {}) {
  if (given !== undefined) {
    const dir = resolve(given);
    if (!isCheckout(dir)) throw new Error(`${dir} is not a checkout of TixXin/fuyu: it needs ${Object.values(FUYU_PACKAGES).join(", ")}.`);
    return dir;
  }
  if (options.standalone || SELF.name === "create-fuyu-plugin") return null;
  if (isCheckout(OWN_CHECKOUT)) return resolve(OWN_CHECKOUT);
  return null;
}

export function devDependencies(checkout, sdkVersion = SDK_VERSION) {
  if (checkout === null) {
    return Object.fromEntries([["fuyu-plugin", sdkVersion], ...Object.entries(TOOLS)].sort(([a], [b]) => a.localeCompare(b)));
  }
  const linked = Object.entries(FUYU_PACKAGES).map(([name, path]) => [name, `file:${join(checkout, path).split(sep).join("/")}`]);
  return Object.fromEntries([...linked, ...Object.entries(TOOLS)].sort(([a], [b]) => a.localeCompare(b)));
}
