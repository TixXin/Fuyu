export const SMOKE_WORKFLOW = "release-smoke.yml";

export function dispatchedRun(runs, since) {
  return runs
    .filter((run) => run.event === "workflow_dispatch" && Date.parse(run.createdAt) >= since - 5000)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function runOutcome(view) {
  if (!view || view.status !== "completed") return "running";
  return view.conclusion === "success" ? "success" : "failed";
}

export function watchRun(run, { repo, id, interval, attempts = 6, pause = 15000 }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const watched = run("gh", ["run", "watch", String(id), "--repo", repo, "--exit-status", "--interval", String(interval)], { allowFailure: true });
    if (watched.status === 0) return true;
    let outcome = "running";
    for (let check = 0; check < 3; check += 1) {
      const viewed = run("gh", ["run", "view", String(id), "--repo", repo, "--json", "status,conclusion"], { capture: true, allowFailure: true });
      if (viewed.status === 0) {
        outcome = runOutcome(JSON.parse(viewed.stdout || "null"));
        break;
      }
      sleep(pause);
    }
    if (outcome !== "running") return outcome === "success";
    console.log(`  Lost track of run ${id} while it is still running (GitHub hiccup); watching it again.`);
    sleep(pause);
  }
  return false;
}

export function waitForJobs(run, { repo, id, polls = 20, pause = 15000 }) {
  let sawNone = false;
  for (let poll = 0; poll < polls; poll += 1) {
    const listed = run("gh", ["api", `repos/${repo}/actions/runs/${id}/jobs`, "--jq", ".total_count"], { capture: true, allowFailure: true });
    if (listed.status === 0) {
      if (Number(listed.stdout.trim()) > 0) return true;
      sawNone = true;
    }
    if (poll < polls - 1) sleep(pause);
  }
  return !sawNone;
}

function dispatchSmoke(run, tag, repo, findPause) {
  const since = Date.now();
  const started = run("gh", ["workflow", "run", SMOKE_WORKFLOW, "--repo", repo, "--ref", "main", "-f", `tag=${tag}`], { capture: true, allowFailure: true });
  if (started.status !== 0) return `could not start ${SMOKE_WORKFLOW}: ${started.stderr.trim()}`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    sleep(findPause);
    const listed = run("gh", ["run", "list", "--repo", repo, "--workflow", SMOKE_WORKFLOW, "--limit", "5", "--json", "databaseId,createdAt,event,url"], { capture: true, allowFailure: true });
    const found = listed.status === 0 ? dispatchedRun(JSON.parse(listed.stdout || "[]"), since) : null;
    if (found) return found;
  }
  return `${SMOKE_WORKFLOW} was started but its run did not show up within a minute`;
}

export function smokeTest(run, tag, repo, { dispatches = 3, findPause = 5000, jobPolls = 20, pause = 15000 } = {}) {
  for (let dispatch = 1; dispatch <= dispatches; dispatch += 1) {
    const found = dispatchSmoke(run, tag, repo, findPause);
    if (typeof found === "string") return found;
    console.log(`Smoke test running on a clean Windows runner: ${found.url}`);
    if (waitForJobs(run, { repo, id: found.databaseId, polls: jobPolls, pause })) {
      return watchRun(run, { repo, id: found.databaseId, interval: 15, pause }) ? null : `the smoke test failed: ${found.url}`;
    }
    run("gh", ["run", "cancel", String(found.databaseId), "--repo", repo], { capture: true, allowFailure: true });
    if (dispatch < dispatches) console.log(`  GitHub never gave run ${found.databaseId} a job; cancelled it and starting the smoke test again.`);
  }
  return `GitHub never gave the smoke test a job in ${dispatches} tries; the release stays a draft. Start ${SMOKE_WORKFLOW} again or check https://www.githubstatus.com`;
}
