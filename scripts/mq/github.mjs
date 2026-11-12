import { execFileSync } from "node:child_process";
import { skeletonBody, writtenBody } from "./prBody.mjs";

function gh(args, input = null) {
  const stdin = input === null ? "ignore" : "pipe";
  return execFileSync("gh", args, { encoding: "utf8", input: input ?? undefined, stdio: [stdin, "pipe", "pipe"], windowsHide: true }).trim();
}

function firstPr(out) {
  return out && out !== "null" ? JSON.parse(out) : null;
}

export const github = {
  login: () => gh(["api", "user", "-q", ".login"]),
  findPr: (head, state = "open") => firstPr(gh(["pr", "list", "--head", head, "--state", state, "--json", "number,url", "-q", ".[0]"])),
  createPr: ({ head, base, title, body }) => {
    const url = gh(["pr", "create", "--head", head, "--base", base, "--title", title, "--body-file", "-"], body).split("\n").pop();
    return { number: Number(url.match(/\/pull\/(\d+)/)?.[1]), url };
  },
  editPr: ({ number, title, body }) => gh(["pr", "edit", String(number), "--title", title, "--body-file", "-"], body),
  autoMerge: (number) => gh(["pr", "merge", String(number), "--auto", "--merge"]),
  view: (number) => JSON.parse(gh(["pr", "view", String(number), "--json", "state,mergeStateStatus,mergeCommit,url,statusCheckRollup"])),
  updateBranch: (number) => gh(["pr", "update-branch", String(number)]),
  openPrs: () => JSON.parse(gh(["pr", "list", "--state", "open", "--limit", "100", "--json", "number,url,isDraft,autoMergeRequest,mergeable,headRefOid,statusCheckRollup"])),
  mainSha: (branch) => gh(["api", `repos/{owner}/{repo}/commits/${branch}`, "-q", ".sha"]),
  behindBy: (baseSha, headSha) => Number(gh(["api", `repos/{owner}/{repo}/compare/${baseSha}...${headSha}`, "-q", ".behind_by"])),
};

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function landBranchName(login, host, branch) {
  const machine = slug(host.split(".")[0]).slice(0, 24) || "host";
  return `land/${login}/${machine}-${slug(branch)}`;
}

export function prText(commits, branch, { title = null, body = null, files = [] } = {}) {
  return {
    title: title?.trim() || commits[0].subject,
    body: body?.trim() ? writtenBody(body, branch) : skeletonBody({ commits, files, branch }),
  };
}

const FAILED = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"]);

export function failedChecks(rollup = []) {
  return rollup.filter((check) => FAILED.has(check.conclusion ?? check.state ?? "")).map((check) => ({ name: check.name ?? check.context, url: check.detailsUrl ?? check.targetUrl ?? "" }));
}
