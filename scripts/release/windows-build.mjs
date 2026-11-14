import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { downloadCiBuild, signUpdate, startCiBuild } from "./ci-build.mjs";
import { msiNames, msiVersion } from "./msi-version.mjs";

export const WINDOWS_WORKFLOW = "release-windows.yml";

export function windowsArtifact(version) {
  return `fuyu-windows-${version}`;
}

export function windowsOverlay(config, version) {
  const pubkey = (config.plugins?.updater?.pubkey ?? "").trim();
  if (!pubkey) throw new Error("src-tauri/tauri.conf.json has no plugins.updater.pubkey; the built app would reject every update.");
  if (config.version !== version) throw new Error(`src-tauri/tauri.conf.json is ${config.version}, not ${version}.`);
  const wix = msiVersion(version);
  return {
    plugins: { updater: { pubkey } },
    bundle: { createUpdaterArtifacts: false, ...(wix ? { windows: { wix: { version: wix } } } : {}) },
  };
}

export function windowsFiles(releaseDir, version) {
  const nsis = join(releaseDir, "bundle", "nsis");
  const msiDir = join(releaseDir, "bundle", "msi");
  const msi = existsSync(msiDir) ? readdirSync(msiDir).find((name) => msiNames(version).some((suffix) => name.endsWith(suffix))) : undefined;
  return {
    installer: join(nsis, `Fuyu_${version}_x64-setup.exe`),
    msi: msi ? join(msiDir, msi) : null,
    exe: join(releaseDir, "fuyu.exe"),
  };
}

export function startWindowsBuild(run, { repo, revision, version }) {
  return startCiBuild(run, { workflow: WINDOWS_WORKFLOW, repo, revision, version });
}

export function finishWindowsBuild(run, { repo, version, since, releaseDir }) {
  for (const dir of [join(releaseDir, "bundle", "nsis"), join(releaseDir, "bundle", "msi")]) rmSync(dir, { recursive: true, force: true });
  rmSync(join(releaseDir, "fuyu.exe"), { force: true });
  const problem = downloadCiBuild(run, { workflow: WINDOWS_WORKFLOW, label: "Windows", repo, artifact: windowsArtifact(version), since, dir: releaseDir });
  if (problem) return problem;
  const files = windowsFiles(releaseDir, version);
  for (const path of [files.installer, files.msi, files.exe]) {
    if (!path || !existsSync(path)) return `the Windows build has no ${path ?? "MSI installer"}`;
  }
  for (const path of [files.installer, files.msi]) {
    if (!signUpdate(path) || !existsSync(`${path}.sig`)) return `could not sign ${path} with the updater key`;
  }
  return null;
}

function collect(version) {
  const built = windowsFiles("src-tauri/target/release", version);
  const out = "out";
  for (const [path, dest] of [
    [built.installer, join(out, "bundle", "nsis")],
    [built.msi, join(out, "bundle", "msi")],
    [built.exe, out],
  ]) {
    if (!path || !existsSync(path)) throw new Error(`the build has no ${path ?? "MSI installer"}`);
    mkdirSync(dest, { recursive: true });
    copyFileSync(path, join(dest, path.split(/[\\/]/).pop()));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, version] = process.argv.slice(2);
  try {
    if (command === "config") {
      const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
      writeFileSync("src-tauri/tauri.release.conf.json", `${JSON.stringify(windowsOverlay(config, version), null, 2)}\n`);
    } else if (command === "collect") {
      collect(version);
    } else {
      throw new Error("usage: node scripts/release/windows-build.mjs config|collect <version>");
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
