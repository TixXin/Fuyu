import { existsSync } from "node:fs";
import { join } from "node:path";
import { downloadCiBuild, signUpdate, startCiBuild } from "./ci-build.mjs";

export { signerArgs } from "./ci-build.mjs";

export const MAC_WORKFLOW = "release-macos.yml";

export function macArtifact(version) {
  return `fuyu-macos-${version}`;
}

export function macFiles(dir, version) {
  const archive = join(dir, `Fuyu_${version}_aarch64.app.tar.gz`);
  return { archive, signature: `${archive}.sig`, dmg: join(dir, `Fuyu_${version}_aarch64.dmg`) };
}

export function startMacBuild(run, { repo, revision, version }) {
  return startCiBuild(run, { workflow: MAC_WORKFLOW, repo, revision, version });
}

export function finishMacBuild(run, { repo, version, since, dir }) {
  const problem = downloadCiBuild(run, { workflow: MAC_WORKFLOW, label: "macOS", repo, artifact: macArtifact(version), since, dir });
  if (problem) return problem;
  const files = macFiles(dir, version);
  if (!existsSync(files.archive) || !existsSync(files.dmg)) return `the macOS build has no ${files.archive} or ${files.dmg}`;
  if (!signUpdate(files.archive) || !existsSync(files.signature)) return "could not sign the macOS update package with the updater key";
  return null;
}
