import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readRecord, verifiedAt } from "../mq/verify.mjs";
import { mergedWith } from "../mq/upto.mjs";
import { git, mainCheckoutOf, tryGit } from "../mq/settings.mjs";
import { createNotifier } from "./notify.mjs";
import { readVersion, VERSION_FILES } from "./versions.mjs";

const REPO = "TixXin/fuyu";
const SNAPSHOT = "tests/regression/snapshots/version-history.html";
const SETTINGS_INDICES = [
  "src/windows/settings/searchIndex.json",
  "src/windows/settings/whatsNewIndex.json",
];
export const MAC_VERIFIED = "mac-verified";
export const LOCAL_STEPS = ["verify", "regression", "exe"];

export const locallyVerified = (record, sha) => record?.sha === sha && LOCAL_STEPS.every((step) => record.passed?.[step]);

export function releaseFiles(version) {
  return [...Object.values(VERSION_FILES), `docs/releases/v${version}.md`, ...SETTINGS_INDICES, SNAPSHOT];
}

export function versionCommitProblem({ subject, files, version }) {
  if (subject !== `chore(release): ${version}`) return `HEAD is "${subject}", not "chore(release): ${version}": commit the version and the notes first.`;
  const allowed = new Set(releaseFiles(version));
  const other = files.filter((file) => !allowed.has(file));
  return other.length ? `the version commit also changes ${other.join(", ")}; it may only change the version files, the notes, the settings indices and the version-history snapshot.` : null;
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
  const { rev, conflicts } = mergedWith(git(["rev-parse", "HEAD"]), "origin/main");
  if (!rev) throw new Error(`The batch conflicts with origin/main${conflicts.length ? ` in ${conflicts.join(", ")}` : ""}; land it with pnpm mq:land first.`);
  if (rev !== git(["rev-parse", "HEAD"])) git(["checkout", "--quiet", "--detach", rev]);
  const main = mainCheckoutOf();
  const touched = git(["diff", "--name-only", `origin/main...${rev}`]).split("\n").filter(Boolean);
  const onlyRelease = touched.every((file) => releaseFiles(version).includes(file) || /(^docs\/|\.md$)/.test(file));
  const already = unverified || onlyRelease || verifiedAt(readRecord(main), rev) || locallyVerified(readRecord(main), rev);
  const macLabel = process.platform === "darwin" && !unverified && !onlyRelease;
  const branch = `land/TixXin/release-${version}`;
  if (!run("git", ["push", "--force-with-lease", "origin", `${rev}:refs/heads/${branch}`])) throw new Error(`Could not push ${branch}.`);
  if (macLabel) spawnSync("gh", ["label", "create", MAC_VERIFIED, "--repo", REPO, "--force", "--color", "0e8a16", "--description", "Release PR verified on a Mac: CI skips rust-macos"], { encoding: "utf8" });
  const listed = spawnSync("gh", ["pr", "list", "--repo", REPO, "--head", branch, "--state", "open", "--json", "number,url", "--jq", ".[0].url // \"\""], { encoding: "utf8" });
  let url = listed.stdout?.trim();
  if (!url) {
    const made = spawnSync("gh", ["pr", "create", "--repo", REPO, "--base", "main", "--head", branch, "--title", `Release ${version}`, "--body-file", body, ...(macLabel ? ["--label", MAC_VERIFIED] : [])], { encoding: "utf8" });
    if (made.status !== 0) throw new Error(`Could not open the PR: ${made.stderr.trim()}`);
    url = made.stdout.trim().split("\n").pop();
  } else if (macLabel) {
    spawnSync("gh", ["pr", "edit", url, "--repo", REPO, "--add-label", MAC_VERIFIED], { encoding: "utf8" });
  }
  const carried = Number(tryGit(["rev-list", "--count", "--no-merges", `origin/main..${rev}`]).out || 0);
  const notify = createNotifier({ prefix: `Fuyu v${version} · ` });
  console.log(`✓ ${url}: ${carried} commit(s) with the version bump; its CI runs now.`);
  notify.send("发版 PR 开了", `${url}，带 ${carried} 个提交，CI、预构建${already ? "" : "和本机验证"}同时跑。`);
  if (!run(process.execPath, ["scripts/release/prebuild.mjs"])) throw new Error("The PR is open, but the prebuild did not start; run pnpm release:prebuild.");
  if (!already) {
    console.log(`\nVerifying ${rev.slice(0, 9)} here (check, regression pages, build:exe) while the PR's CI and the prebuild run; auto-merge waits for it.`);
    run("pnpm", ["mq:verify", rev, "--no-ci"]);
    if (!locallyVerified(readRecord(main), rev)) {
      notify.send("本机验证没过", `${url} 开着但没开自动合并，修好后重新 release:open。`);
      throw new Error(`The local verification of ${rev.slice(0, 9)} failed, so auto-merge stays off on ${url}. Fix it in the main checkout, move the version commit onto the fix (see the fuyu-release skill), and run pnpm release:open again.`);
    }
  }
  if (!run("gh", ["pr", "merge", url, "--repo", REPO, "--auto", "--merge"])) throw new Error(`Could not turn on auto-merge for ${url}.`);
  console.log(`✓ Auto-merge on for ${url}.`);
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
