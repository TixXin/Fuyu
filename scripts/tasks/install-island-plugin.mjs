import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { islandHome } from "../../packages/fuyu-plugin/src/dev.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";

const ID = "dev.focusd.dev-tasks";
const here = path.dirname(fileURLToPath(import.meta.url));

export function pluginsDir(env = process.env, exists = existsSync) {
  if (!env.APPDATA) throw new Error("APPDATA is not set; this installs into the Windows Fuyu only.");
  const home = islandHome(env);
  if (exists(path.join(home, "home-migration.json"))) return path.join(home, "plugins");
  return path.join(env.APPDATA, "com.tixxin.fuyu", "plugins");
}

function main() {
  const main = mainCheckout();
  const target = path.join(pluginsDir(), ID);
  mkdirSync(path.join(target, "lib"), { recursive: true });
  cpSync(path.join(here, "island-plugin"), target, { recursive: true });
  copyFileSync(path.join(main, "plugins/sdk/powershell/fuyu.ps1"), path.join(target, "lib/fuyu.ps1"));
  for (const old of ["focusd-plugin.json", "lib/focusd.ps1"]) rmSync(path.join(target, old), { force: true });
  writeFileSync(path.join(target, "repo.txt"), `${main}\n`);
  console.log(`[tasks:plugin] installed ${ID} into ${target} (repo ${main}).`);
  console.log("[tasks:plugin] In Settings > Plugins: allow third-party plugins, Reload, then enable 开发任务看板.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
