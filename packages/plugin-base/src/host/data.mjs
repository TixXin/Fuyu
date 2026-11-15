import { join } from "node:path";
import { pluginId } from "./clients.mjs";

export const DATA_DIR = "data";
const SEGMENT = /^[A-Za-z0-9@_][A-Za-z0-9@._-]{0,127}$/;

export function dataDirOf(root, id) {
  const parts = typeof id === "string" ? id.split("/") : [];
  const scoped = parts.length === 2 && parts[0].startsWith("@");
  if (!(parts.length === 1 || scoped) || !parts.every((part) => SEGMENT.test(part) && !/\.$/.test(part))) {
    throw new Error(`the plugin id ${JSON.stringify(id)} cannot name a data folder; use letters, digits, ".", "-", "_" (or @scope/name)`);
  }
  return join(root, ...parts);
}

export function installDataDir(ctx, root) {
  return ctx.reflect.accessor("dataDir", {
    get() {
      return dataDirOf(root, pluginId(this));
    },
  });
}
