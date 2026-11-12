import { execFileSync } from "node:child_process";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).trim();
}

function firstPr(out) {
  return out && out !== "null" ? JSON.parse(out) : null;
}

export const github = {
  login: () => gh(["api", "user", "-q", ".login"]),
  findPr: (head, state = "open") => firstPr(gh(["pr", "list", "--head", head, "--state", state, "--json", "number,url", "-q", ".[0]"])),
  createPr: ({ head, base, title, body }) => {
    const url = gh(["pr", "create", "--head", head, "--base", base, "--title", title, "--body", body]).split("\n").pop();
    return { number: Number(url.match(/\/pull\/(\d+)/)?.[1]), url };
  },
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

export function prText(commits, branch) {
  const footer = `由 \`pnpm mq:land\` 从 \`${branch}\` 开出，CI 通过后自动合入。`;
  if (commits.length === 1) {
    const [{ subject, body }] = commits;
    return { title: subject, body: [body.trim(), footer].filter(Boolean).join("\n\n") };
  }
  return { title: commits[0].subject, body: [...commits.map(({ subject }) => `- ${subject}`), "", footer].join("\n") };
}

const FAILED = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"]);

export function failedChecks(rollup = []) {
  return rollup.filter((check) => FAILED.has(check.conclusion ?? check.state ?? "")).map((check) => ({ name: check.name ?? check.context, url: check.detailsUrl ?? check.targetUrl ?? "" }));
}
