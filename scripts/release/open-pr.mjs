import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readRecord, verificationRefusal } from "../mq/verify.mjs";
import { mergedWith } from "../mq/upto.mjs";
import { git, tryGit } from "../mq/settings.mjs";
import { createNotifier } from "./notify.mjs";
import { readVersion, VERSION_FILES } from "./versions.mjs";

const REPO = "TixXin/fuyu";
const SNAPSHOT = "tests/regression/snapshots/version-history.html";

export function releaseFiles(version) {
  return [...Object.values(VERSION_FILES), `docs/releases/v${version}.md`, SNAPSHOT];
}

export function versionCommitProblem({ subject, files, version }) {
  if (subject !== `chore(release): ${version}`) return `HEAD is "${subject}", not "chore(release): ${version}": commit the version and the notes first.`;
  const allowed = new Set(releaseFiles(version));
  const other = files.filter((file) => !allowed.has(file));
  return other.length ? `the version commit also changes ${other.join(", ")}; it may only change the version files, the notes and the version-history snapshot.` : null;
}

export function openRequest(args) {
  const at = args.indexOf("--body");
  const body = at >= 0 ? args[at + 1] : null;
  if (!body || !existsSync(body)) return { error: "usage: pnpm release:open --body <Chinese PR body file> [--unverified]" };
  return { body, unverified: args.includes("--unverified") };
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true, shell: process.platform === "win32" });
  return result.status === 0;
}

function open({ body, unverified }) {
  const versions = Object.entries(VERSION_FILES).map(([kind, path]) => readVersion(kind, readFileSync(path, "utf8")));
  const version = versions[0];
  if (!version || versions.some((found) => found !== version)) throw new Error("The four version files disagree; run pnpm release:version first.");
  if (tryGit(["status", "--porcelain", "--", ...releaseFiles(version)]).out) throw new Error("The version or the notes have uncommitted changes; commit them first.");
  const subject = git(["log", "-1", "--format=%s"]);
  const problem = versionCommitProblem({ subject, files: git(["diff", "--name-only", "HEAD^", "HEAD"]).split("\n").filter(Boolean), version });
  if (problem) throw new Error(problem);
  git(["fetch", "origin", "main", "--quiet"]);
  const batch = git(["rev-parse", "HEAD^"]);
  const files = git(["diff", "--name-only", `origin/main...${batch}`]).split("\n").filter(Boolean);
  const refusal = files.length ? verificationRefusal({ record: readRecord(), target: batch, files, unverified }) : null;
  if (refusal) throw new Error(`${refusal}\n  (pnpm release:open takes --unverified the same way.)`);
  const { rev, conflicts } = mergedWith(git(["rev-parse", "HEAD"]), "origin/main");
  if (!rev) throw new Error(`The batch conflicts with origin/main${conflicts.length ? ` in ${conflicts.join(", ")}` : ""}; land it with pnpm mq:land first.`);
  if (rev !== git(["rev-parse", "HEAD"])) git(["checkout", "--quiet", "--detach", rev]);
  const branch = `land/TixXin/release-${version}`;
  if (!run("git", ["push", "--force-with-lease", "origin", `${rev}:refs/heads/${branch}`])) throw new Error(`Could not push ${branch}.`);
  const listed = spawnSync("gh", ["pr", "list", "--repo", REPO, "--head", branch, "--state", "open", "--json", "number,url", "--jq", ".[0].url // \"\""], { encoding: "utf8" });
  let url = listed.stdout?.trim();
  if (!url) {
    const made = spawnSync("gh", ["pr", "create", "--repo", REPO, "--base", "main", "--head", branch, "--title", `Release ${version}`, "--body-file", body], { encoding: "utf8" });
    if (made.status !== 0) throw new Error(`Could not open the PR: ${made.stderr.trim()}`);
    url = made.stdout.trim().split("\n").pop();
  }
  if (!run("gh", ["pr", "merge", url, "--repo", REPO, "--auto", "--merge"])) throw new Error(`Could not turn on auto-merge for ${url}.`);
  const carried = Number(tryGit(["rev-list", "--count", "--no-merges", `origin/main..${rev}`]).out || 0);
  console.log(`✓ ${url}: ${carried} commit(s) with the version bump, auto-merge on.`);
  createNotifier({ prefix: `Fuyu v${version} · ` }).send("发版 PR 开了", `${url}，带 ${carried} 个提交，同时开始预构建。`);
  if (!run(process.execPath, ["scripts/release/prebuild.mjs"])) throw new Error("The PR is open, but the prebuild did not start; run pnpm release:prebuild.");
  const number = url.split("/").pop();
  console.log(`\nNext: in the main checkout, pnpm mq:wait ${number} in the background; once merged, check out the merge commit here and pnpm release.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const request = openRequest(process.argv.slice(2));
  if (request.error) {
    console.error(request.error);
    process.exit(1);
  }
  try {
    open(request);
  } catch (error) {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
  }
}
