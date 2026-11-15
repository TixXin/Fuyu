import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseRepository, signPackage, validateManifest, verifyPackage } from "@fuyu/plugin-manifest";
import { publicKeyOf, signCommit, verifyCommit } from "@fuyu/plugin-market";
import { readAt, repoPrefix, resolveCommit } from "./git.mjs";

export function githubUrl(repository) {
  const ref = parseRepository(repository);
  if (!ref || ref.host !== "github.com") return null;
  return `https://github.com/${ref.owner}/${ref.repo}`;
}

export function commitFields(dir, { commit = "HEAD", repository } = {}) {
  let sha;
  try {
    sha = resolveCommit(dir, commit);
  } catch {
    throw new Error(`"${commit}" is not a commit in the git repository at ${dir}`);
  }
  const prefix = repoPrefix(dir);
  let pkg;
  try {
    pkg = JSON.parse(readAt(dir, sha, `${prefix}package.json`).toString("utf8"));
  } catch (error) {
    throw new Error(`cannot read ${prefix}package.json at ${sha.slice(0, 12)}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const checked = validateManifest(pkg, { stage: "source", allowExperimental: false });
  if (!checked.ok) {
    throw Object.assign(new Error(`package.json at ${sha.slice(0, 12)} has errors; fix them before signing`), { issues: checked.errors });
  }
  const url = repository ?? githubUrl(pkg.repository);
  if (!url) throw new Error('the market only takes GitHub repositories: set repository to "github:<owner>/<name>"');
  return { name: pkg.name, version: pkg.version, repository: url, commit: sha };
}

export function signCommitAt(dir, privateKey, options = {}) {
  const fields = commitFields(dir, options);
  const authorSignature = signCommit(fields, privateKey);
  const key = publicKeyOf(privateKey);
  if (verifyCommit(fields, authorSignature, [key]) !== key.keyId) throw new Error("the new signature does not verify");
  return { ...fields, authorSignature, publicKey: key.publicKey };
}

export function signPackageFile(file, privateKey, out = file) {
  const signed = signPackage(readFileSync(resolve(file)), "author", privateKey);
  const key = publicKeyOf(privateKey);
  const result = verifyPackage(signed, { author: [key] });
  if (result.author !== key.keyId) throw new Error(`the signed package does not verify: ${result.problems.join("; ")}`);
  writeFileSync(resolve(out), signed);
  return { file: resolve(out), name: result.manifest.name, version: result.manifest.version, digest: result.digest, keyId: key.keyId };
}
