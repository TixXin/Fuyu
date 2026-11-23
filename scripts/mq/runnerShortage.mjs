import { idsFromUrl } from "./flaky.mjs";

export const MAX_SHORTAGE_RERUNS = 2;
const NO_RUNNER = /not acquired by Runner/i;
const GATHER = "check";

export const isStarved = (messages = []) => messages.some((message) => NO_RUNNER.test(message));

export function starvedRun(github, failed) {
  let runId = null;
  let starved = false;
  for (const { name, url } of failed) {
    const { run, job } = idsFromUrl(url);
    if (job && isStarved(github.annotations(job))) {
      starved = true;
      runId ??= run;
    } else if (name !== GATHER) {
      return null;
    }
  }
  return starved ? runId : null;
}

export function rerunStarved(github, failed, { log = console.log } = {}) {
  let runId;
  try {
    runId = starvedRun(github, failed);
  } catch {
    return null;
  }
  if (!runId) return null;
  try {
    github.rerunFailed(runId);
  } catch {
    return "pending";
  }
  log(`[wait] GitHub 没排到 Mac 机器，任务被取消，不是代码的问题；已自动重跑 run ${runId} 里没过的任务。`);
  return "rerun";
}

export function runShortage(run, repo, runId) {
  const gh = (args) => run("gh", args, { capture: true, allowFailure: true });
  const jobs = gh(["api", `repos/${repo}/actions/runs/${runId}/jobs`, "-q", "[.jobs[] | select(.conclusion != \"success\" and .conclusion != \"skipped\") | {id, name}]"]);
  if (jobs.status !== 0) return false;
  const failed = JSON.parse(jobs.stdout || "[]").map(({ id, name }) => ({ name, url: `https://github.com/${repo}/actions/runs/${runId}/job/${id}` }));
  const github = {
    annotations: (job) => {
      const listed = gh(["api", `repos/${repo}/check-runs/${job}/annotations`, "-q", "[.[].message]"]);
      return listed.status === 0 ? JSON.parse(listed.stdout || "[]") : [];
    },
    rerunFailed: (id) => {
      const rerun = gh(["run", "rerun", String(id), "--repo", repo, "--failed"]);
      if (rerun.status !== 0) throw new Error(rerun.stderr);
    },
  };
  return failed.length > 0 && rerunStarved(github, failed, { log: () => {} }) === "rerun";
}
