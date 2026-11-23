import { setTimeout as delay } from "node:timers/promises";
import { remoteGit } from "./cleanup.mjs";
import { github as realGitHub } from "./github.mjs";
import { pushTry } from "./try.mjs";

const POLL_MS = 30_000;
const START_LIMIT_MS = 3 * 60_000;
const TOTAL_LIMIT_MS = 90 * 60_000;
const FAILED = new Set(["failure", "cancelled", "timed_out", "startup_failure", "action_required"]);

export function ciVerdict(runs, jobs) {
  if (!runs.length) return { state: "none" };
  const failedJobs = jobs.filter((job) => FAILED.has(job.conclusion)).map((job) => job.name);
  const failedRuns = runs.filter((run) => run.status === "completed" && FAILED.has(run.conclusion));
  const finished = runs.every((run) => run.status === "completed");
  if (failedJobs.length || failedRuns.length) return { state: "failed", failed: failedJobs.length ? failedJobs : failedRuns.map((run) => run.conclusion), finished };
  if (finished) return { state: "passed", finished };
  const done = jobs.filter((job) => job.status === "completed").length;
  return { state: "running", progress: `${done}/${jobs.length} 个 job 跑完` };
}

function look(github, branch, rev) {
  const runs = github.runs(branch).filter((run) => run.headSha === rev);
  const jobs = runs.flatMap((run) => github.runJobs(run.databaseId));
  return { url: runs[0]?.url ?? "", verdict: ciVerdict(runs, jobs) };
}

function finish(remote, branch, ok, detail, url, finished) {
  const where = url ? `（${url}）` : "";
  if (!finished) return { ok, detail: `${detail}${where}；CI 还在跑，${branch} 先留着，跑完后 pnpm mq:try --clean 删` };
  const error = remote.remove(branch);
  return { ok, detail: `${detail}${where}${error ? `；没能删掉 ${branch}：${error}，稍后 pnpm mq:try --clean` : ""}` };
}

export async function runCi({ sha, github = realGitHub, remote = remoteGit, host = null, aliases = null, push = pushTry, sleep = delay, now = Date.now, state = {} }) {
  let pushed;
  try {
    pushed = push({ github, host, aliases, head: sha, what: `提交 ${sha.slice(0, 9)}`, tag: "verify" });
  } catch (error) {
    return { ok: false, detail: `没能推到 try 分支：${`${error.stderr ?? error.message}`.trim()}；没网时加 --no-ci，之后 --only ci 补上` };
  }
  if (pushed.error) return { ok: false, detail: pushed.error };
  const { rev, remoteBranch } = pushed;
  const start = now();
  let url = "";
  for (;;) {
    let seen = null;
    try {
      seen = look(github, remoteBranch, rev);
      url = seen.url || url;
    } catch (error) {
      state.lastLine = `查 CI 失败，稍后再查：${`${error.stderr ?? error.message}`.trim().split("\n")[0]}`;
    }
    const verdict = seen?.verdict;
    if (verdict?.state === "passed") return finish(remote, remoteBranch, true, "", url, true);
    if (verdict?.state === "failed") return finish(remote, remoteBranch, false, `挂了：${verdict.failed.join("、")}`, url, verdict.finished);
    const waited = now() - start;
    if (verdict?.state === "none" && waited > START_LIMIT_MS) return { ok: false, detail: `CI 没在 ${remoteBranch} 上跑起来，稍后 gh run list --branch ${remoteBranch} 看` };
    if (waited > TOTAL_LIMIT_MS) return finish(remote, remoteBranch, false, "等了 90 分钟还没跑完", url, false);
    if (verdict?.state === "running") state.lastLine = `${verdict.progress}${url ? ` · ${url}` : ""}`;
    await sleep(POLL_MS);
  }
}
