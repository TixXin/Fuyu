const PAGE = /✗ ([\w./-]+?\.html)/;
const HISTORY_RUNS = 30;
const MAX_LOOKED = 8;

export const isRegressionCheck = (name = "") => /regression/i.test(name);

export function failedPages(log = "") {
  const pages = new Set();
  for (const line of log.split("\n")) {
    const page = line.match(PAGE)?.[1];
    if (page) pages.add(page.split("/").pop());
  }
  return [...pages];
}

export function idsFromUrl(url = "") {
  return { run: Number(url.match(/\/runs\/(\d+)/)?.[1]) || null, job: Number(url.match(/\/job\/(\d+)/)?.[1]) || null };
}

export function suspectRuns(runs, excludeRun) {
  return runs
    .filter((run) => run.databaseId !== excludeRun && (run.headBranch === "main" || run.headBranch?.startsWith("land/")))
    .filter((run) => run.conclusion === "failure" || run.attempt > 1)
    .slice(0, MAX_LOOKED);
}

export function pastFailures(github, pages, excludeRun) {
  const seen = new Map(pages.map((page) => [page, []]));
  for (const run of suspectRuns(github.ciRuns(HISTORY_RUNS), excludeRun)) {
    const last = run.conclusion === "failure" ? run.attempt : run.attempt - 1;
    for (let attempt = 1; attempt <= last; attempt += 1) {
      for (const job of github.attemptJobs(run.databaseId, attempt)) {
        if (!isRegressionCheck(job.name) || job.conclusion !== "failure") continue;
        for (const page of failedPages(github.jobLog(job.id))) seen.get(page)?.push({ url: run.url, branch: run.headBranch, attempt });
      }
    }
  }
  return seen;
}

export function flakyAdvice(seen, runId) {
  const flaky = [...seen].filter(([, hits]) => hits.length > 0);
  const lines = [`[wait] 挂掉的回归页：${[...seen.keys()].join("、")}`];
  for (const [page, hits] of seen) {
    if (hits.length === 0) {
      lines.push(`  ${page}：最近 main 和 land 的 CI 里没挂过，当真失败查。`);
      continue;
    }
    lines.push(`  ${page}：疑似时好时坏，最近 main 和 land 的 CI 里挂过 ${hits.length} 次：`);
    for (const { url, branch, attempt } of hits.slice(0, 3)) lines.push(`    ${branch}（第 ${attempt} 次运行）${url}`);
  }
  if (flaky.length > 0) {
    lines.push(`  疑似时好时坏的页先开任务查（pnpm tasks id D 挑编号、先提 issue），写下挂在哪一步、几次挂几次；修法见 fuyu-testing skill「时好时坏」。`);
    if (flaky.length === seen.size && runId) lines.push(`  挂的全是这类页：确认不是这批改动碰到的文件后，可以 gh run rerun ${runId} --failed 重跑。`);
  }
  return lines;
}

export function flakyReport(github, failed, { log = () => {} } = {}) {
  const regression = failed.filter(({ name }) => isRegressionCheck(name));
  if (regression.length === 0) return [];
  log("[wait] 查挂掉的回归页最近在 main 和 land 的 CI 里挂没挂过（要几十秒）…");
  try {
    const pages = new Set();
    let runId = null;
    for (const { url } of regression) {
      const ids = idsFromUrl(url);
      runId ??= ids.run;
      if (ids.job) for (const page of failedPages(github.jobLog(ids.job))) pages.add(page);
    }
    if (pages.size === 0) return ["[wait] 回归页的检查挂了，但日志里找不到挂掉的页（不是页面失败，或者日志还读不到）。"];
    return flakyAdvice(pastFailures(github, [...pages], runId), runId);
  } catch (error) {
    return [`[wait] 查不到回归页以前挂没挂过：${`${error.stderr ?? error.message}`.trim().split("\n")[0]}`];
  }
}
