// The release smoke test (task D26): `pnpm release` starts .github/workflows/release-smoke.yml
// on the draft it uploaded and waits for it; only a pass publishes the release. The workflow
// installs and starts the app on a clean Windows runner (scripts/release/smoke-test.ps1), which
// this machine cannot do: a release build here would share the user's own island's identifier,
// data and single-instance lock.

export const SMOKE_WORKFLOW = "release-smoke.yml";

/** The run a dispatch made: the newest workflow_dispatch run created at or after `since` (ms). */
export function dispatchedRun(runs, since) {
  return runs
    .filter((run) => run.event === "workflow_dispatch" && Date.parse(run.createdAt) >= since - 5000)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

/**
 * Runs the smoke test on `tag`'s draft and waits for it. `run` is release.mjs's command runner;
 * returns null on a pass, or a message saying what failed.
 */
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
  const watched = run("gh", ["run", "watch", String(found.databaseId), "--repo", repo, "--exit-status", "--interval", "15"], { allowFailure: true });
  return watched.status === 0 ? null : `the smoke test failed: ${found.url}`;
}
