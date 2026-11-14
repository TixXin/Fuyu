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

export function smokeTest(run, tag, repo) {
  const since = Date.now();
  const started = run("gh", ["workflow", "run", SMOKE_WORKFLOW, "--repo", repo, "--ref", "main", "-f", `tag=${tag}`], { capture: true, allowFailure: true });
  if (started.status !== 0) return `could not start ${SMOKE_WORKFLOW}: ${started.stderr.trim()}`;
  let found = null;
  for (let attempt = 0; attempt < 12 && !found; attempt += 1) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    const listed = run("gh", ["run", "list", "--repo", repo, "--workflow", SMOKE_WORKFLOW, "--limit", "5", "--json", "databaseId,createdAt,event,url"], { capture: true, allowFailure: true });
    if (listed.status === 0) found = dispatchedRun(JSON.parse(listed.stdout || "[]"), since);
  }
  if (!found) return `${SMOKE_WORKFLOW} was started but its run did not show up within a minute`;
  console.log(`Smoke test running on a clean Windows runner: ${found.url}`);
  return watchRun(run, { repo, id: found.databaseId, interval: 15 }) ? null : `the smoke test failed: ${found.url}`;
}
