import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { channelProblems } from "./after-release.mjs";
import { commandLine } from "./command-line.mjs";

export const SITE_ORIGIN = "https://fuyu.tix.xin";
const ATTEMPTS = 3;

export function siteCheckout(main, env = process.env) {
  return env.FUYU_SITE_DIR || join(dirname(main), "fuyu-desktop");
}

export const siteImportCommand = (dir, tag) => `cd ${dir} && pnpm releases:import ${tag}`;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function importOnce(dir, tag) {
  const windows = process.platform === "win32";
  const args = ["releases:import", tag];
  return new Promise((resolve) => {
    const child = spawn(windows ? commandLine("pnpm", args) : "pnpm", windows ? [] : args, { cwd: dir, stdio: "inherit", shell: windows, windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function readSiteVersion(channel, fetchImpl) {
  try {
    const response = await fetchImpl(`${SITE_ORIGIN}/api/update/${channel}/latest.json`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()).version ?? null;
  } catch {
    return null;
  }
}

export async function siteDown(fetchImpl = fetch) {
  const url = `${SITE_ORIGIN}/api/update/stable/latest.json`;
  try {
    const response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (response.ok) return null;
    return `${url} answers ${response.status}: the site's update API looks down, so the import at the end will fail. Fix the site (fuyu-desktop) now, or pass --no-site and import later.`;
  } catch (error) {
    return `${url} cannot be read (${error.message}): the site's update API looks down, so the import at the end will fail. Fix the site (fuyu-desktop) now, or pass --no-site and import later.`;
  }
}

export async function siteChannelProblems(version, fetchImpl = fetch) {
  return channelProblems(version, {
    stable: await readSiteVersion("stable", fetchImpl),
    beta: await readSiteVersion("beta", fetchImpl),
  });
}

export async function publishToSite({ main, tag, version }) {
  const dir = siteCheckout(main);
  const manual = siteImportCommand(dir, tag);
  if (!existsSync(join(dir, "scripts", "import-release.mjs"))) {
    return [`The site checkout is not at ${dir} (set FUYU_SITE_DIR); ${SITE_ORIGIN} still offers the old version. Import by hand: ${manual}`];
  }
  let imported = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !imported; attempt += 1) {
    if (attempt > 1) {
      console.log(`  Retrying the site import (${attempt}/${ATTEMPTS})…`);
      await pause(10_000);
    }
    imported = await importOnce(dir, tag);
  }
  if (!imported) return [`Could not import ${tag} to ${SITE_ORIGIN}; clients that read it first stay on the old version. Import by hand: ${manual}`];
  let problems = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await pause(5_000);
    problems = await siteChannelProblems(version);
    if (problems.length === 0) break;
  }
  return problems.map((problem) => `${SITE_ORIGIN}: ${problem}`);
}
