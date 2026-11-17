import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareReleaseResources, releaseResources, verifyShippedResources } from "../plugins-v3/release-resources.mjs";
import { downloadCiBuild, signUpdate, startCiBuild } from "./ci-build.mjs";

export { signerArgs } from "./ci-build.mjs";

export const MAC_WORKFLOW = "release-macos.yml";

export function macArtifact(version) {
  return `fuyu-macos-${version}`;
}

export function macOverlay() {
  return {
    bundle: {
      createUpdaterArtifacts: false,
      resources: releaseResources(),
    },
  };
}

export function verifyMacResources(appDir) {
  verifyShippedResources(join(appDir, "Contents", "Resources"));
}

export function macFiles(dir, version) {
  const archive = join(dir, `Fuyu_${version}_aarch64.app.tar.gz`);
  return { archive, signature: `${archive}.sig`, dmg: join(dir, `Fuyu_${version}_aarch64.dmg`) };
}

export function startMacBuild(run, { repo, revision, version }) {
  return startCiBuild(run, { workflow: MAC_WORKFLOW, repo, revision, version });
}

export function finishMacBuild(run, { repo, version, since, runId, dir }) {
  const problem = downloadCiBuild(run, { workflow: MAC_WORKFLOW, label: "macOS", repo, artifact: macArtifact(version), since, runId, dir });
  if (problem) return problem;
  const files = macFiles(dir, version);
  if (!existsSync(files.archive) || !existsSync(files.dmg)) return `the macOS build has no ${files.archive} or ${files.dmg}`;
  if (!signUpdate(files.archive) || !existsSync(files.signature)) return "could not sign the macOS update package with the updater key";
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, arg] = process.argv.slice(2);
  try {
    if (command === "config") {
      writeFileSync("src-tauri/tauri.release.conf.json", `${JSON.stringify(macOverlay(), null, 2)}\n`);
      await prepareReleaseResources();
    } else if (command === "verify") {
      if (!arg) throw new Error("usage: node scripts/release/mac-build.mjs verify <appDir>");
      verifyMacResources(arg);
    } else {
      throw new Error("usage: node scripts/release/mac-build.mjs config|verify [appDir]");
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
