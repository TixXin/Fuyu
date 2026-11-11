// `pnpm tasks:plugin`: installs the dev task board plugin (island-plugin/) into
// this computer's Fuyu plugin folder, with the PowerShell SDK (plugins/sdk/powershell)
// and the main checkout recorded as its repository. It is not
// on the plugin market: it is only useful while developing this repo. Then, in
// Settings > Plugins: allow third-party plugins, reload, enable "开发任务看板".
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout } from "../build-dirs.mjs";

const ID = "dev.focusd.dev-tasks";
const here = path.dirname(fileURLToPath(import.meta.url));

/** The island's plugin folder: %APPDATA%\com.tixxin.fuyu\plugins. */
export function pluginsDir(env = process.env) {
  if (!env.APPDATA) throw new Error("APPDATA is not set; this installs into the Windows Fuyu only.");
  return path.join(env.APPDATA, "com.tixxin.fuyu", "plugins");
}

function main() {
  const main = mainCheckout();
  const target = path.join(pluginsDir(), ID);
  mkdirSync(path.join(target, "lib"), { recursive: true });
  cpSync(path.join(here, "island-plugin"), target, { recursive: true });
  copyFileSync(path.join(main, "plugins/sdk/powershell/fuyu.ps1"), path.join(target, "lib/fuyu.ps1"));
  // What an install from before the move to the Fuyu SDK left behind.
  for (const old of ["focusd-plugin.json", "lib/focusd.ps1"]) rmSync(path.join(target, old), { force: true });
  writeFileSync(path.join(target, "repo.txt"), `${main}\n`);
  console.log(`[tasks:plugin] installed ${ID} into ${target} (repo ${main}).`);
  console.log("[tasks:plugin] In Settings > Plugins: allow third-party plugins, Reload, then enable 开发任务看板.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
