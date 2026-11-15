import { SHARED_MODULES } from "@fuyu/plugin-base/protocol";

export const DEFAULT_SHARED_MODULES = Object.freeze({ ...SHARED_MODULES });

export const HOST_EXTERNALS = Object.freeze(["fuyu-plugin", "@fuyu/plugin-base"]);

export const APP_MODULES = Object.freeze(["react", "react-dom", "fuyu-plugin", "@fuyu/plugin-base"]);

export const INSTALLED_PACKAGE_DEPTH = 3;

export const isPackageOrSubpath = (specifier, name) => specifier === name || specifier.startsWith(`${name}/`);

export function sharedPath(output, target, packageDepth = null) {
  if (packageDepth === null || packageDepth === undefined) return `/${target}`;
  const depth = output.split("/").length - 1 + packageDepth;
  return `${"../".repeat(depth)}${target}`;
}
