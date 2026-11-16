#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const EXAMPLE = fileURLToPath(new URL("../../packages/plugin-base/examples/hello", import.meta.url));
const ENTRY = "- id: hello\n  name: ./hello/host.mjs\n";

export function devPluginsDir({ lane = "1", platform = process.platform, env = process.env, home = homedir() } = {}) {
  const identifier = `com.tixxin.fuyu.lane-${lane}`;
  if (platform === "win32") return join(env.APPDATA ?? join(home, "AppData", "Roaming"), identifier, "plugins-v3");
  if (platform === "darwin") return join(home, "Library", "Application Support", identifier, "plugins-v3");
  return join(env.XDG_DATA_HOME ?? join(home, ".local", "share"), identifier, "plugins-v3");
}

export function installDemo(dir) {
  mkdirSync(dir, { recursive: true });
  cpSync(EXAMPLE, join(dir, "hello"), { recursive: true });
  const config = join(dir, "plugins.yml");
  const current = existsSync(config) ? readFileSync(config, "utf8") : "";
  const listed = /^\s*-\s*id:\s*hello\s*$/m.test(current);
  if (!listed) {
    const base = current.trim() === "" || current.trim() === "[]" ? "" : current.endsWith("\n") ? current : `${current}\n`;
    writeFileSync(config, base + ENTRY);
  }
  return { dir, added: !listed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { dir: { type: "string" }, lane: { type: "string" } } });
  const dir = values.dir ?? devPluginsDir({ lane: values.lane ?? process.env.FUYU_DEV_LANE ?? process.env.FOCUSD_DEV_LANE ?? "1" });
  const { added } = installDemo(dir);
  console.log(`[plugins-v3] the hello plugin is in ${dir}${added ? " and listed in plugins.yml" : " (already listed in plugins.yml)"}`);
  console.log("[plugins-v3] run the development build (it starts the plugin host unless FUYU_PLUGINS_V3=0) and open the island to see it");
}
