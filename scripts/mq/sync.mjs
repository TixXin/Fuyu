import { spawnSync } from "node:child_process";
import { retryOnLock, waitForIndex } from "./indexLock.mjs";
import { INTEGRATION_BRANCH, LOCKFILES, mainCheckoutOf, tryGit } from "./settings.mjs";
import { changedBetween, dirtyEntries, syncAround } from "./syncAround.mjs";

function dependencyNames(main, rev) {
  const raw = tryGit(["show", `${rev}:package.json`], main);
  if (!raw.ok) return new Set();
  try {
    const pkg = JSON.parse(raw.out);
    return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  } catch {
    return new Set();
  }
}

export function lockfileChanged(changedFiles) {
  return LOCKFILES.some((file) => changedFiles.includes(file));
}

export function removedDependencies(before, after) {
  return [...before].filter((name) => !after.has(name));
}

function refreshDependencies(main, before, after) {
  const changed = tryGit(["diff", "--name-only", before, after], main).out.split("\n");
  if (!lockfileChanged(changed)) return;
  const removed = removedDependencies(dependencyNames(main, before), dependencyNames(main, after));
  if (removed.length) {
    console.error(`[sync] package.json dropped ${removed.join(", ")}; not installing in the main checkout. Run pnpm install there by hand.`);
    return;
  }
  console.log("[sync] the lockfile changed; running pnpm install in the main checkout");
  const result = spawnSync("pnpm", ["install"], { cwd: main, shell: process.platform === "win32", stdio: "inherit" });
  if (result.status !== 0) console.error(`[sync] pnpm install failed in ${main}; run it there by hand.`);
}

function reportBlocked({ conflicts = [], blocked = [], moved = false, busy = null }) {
  if (busy === "index.lock") console.error(`[sync] another git process kept index.lock the whole time; left untouched. Run pnpm mq:sync again later.`);
  if (busy === "files") console.error(`[sync] uncommitted files changed while syncing; left untouched. Run pnpm mq:sync again.`);
  if (moved) console.error(`[sync] ${INTEGRATION_BRANCH} moved while syncing (another commit); run pnpm mq:sync again.`);
  if (conflicts.length) console.error(`[sync] local ${INTEGRATION_BRANCH} and origin/${INTEGRATION_BRANCH} changed the same lines in: ${conflicts.join(", ")}. Resolve it with git merge origin/${INTEGRATION_BRANCH} only once git status shows no uncommitted tracked files; a plain git merge over other sessions' edits can wipe them (#688).`);
  if (blocked.length) {
    console.error(`[sync] uncommitted changes in the main checkout are in the way; left untouched. pnpm tasks dirty shows whose they are:`);
    for (const { file, why } of blocked) console.error(`  ${file}: ${why}`);
  }
  return 0;
}

function fastForwardIsSafe(main, upstream) {
  const head = tryGit(["rev-parse", "HEAD"], main).out;
  if (!tryGit(["merge-base", "--is-ancestor", head, upstream], main).ok) return false;
  const dirty = dirtyEntries(main);
  return !changedBetween(main, head, upstream).some((file) => dirty.has(file));
}

function bringUp(main, upstream) {
  if (!waitForIndex(main)) return { ok: false, busy: "index.lock" };
  if (fastForwardIsSafe(main, upstream)) {
    const forward = retryOnLock(() => tryGit(["merge", "--ff-only", upstream], main));
    if (forward.ok) return { ok: true, kept: [], raced: [] };
  }
  return syncAround(main, upstream);
}

export function sync(cwd = process.cwd()) {
  let main;
  try {
    main = mainCheckoutOf(cwd);
  } catch {
    console.error("[sync] not inside a git repository; nothing to do.");
    return 0;
  }
  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"], main).out.trim();
  if (branch !== INTEGRATION_BRANCH) {
    console.error(`[sync] the main checkout is on '${branch || "?"}', not ${INTEGRATION_BRANCH}; left untouched.`);
    return 0;
  }
  const before = tryGit(["rev-parse", "--short", "HEAD"], main).out.trim();
  tryGit(["fetch", "origin", "--quiet"], main);
  const upstream = `origin/${INTEGRATION_BRANCH}`;
  if (!tryGit(["merge-base", "--is-ancestor", upstream, "HEAD"], main).ok) {
    const around = bringUp(main, upstream);
    if (!around.ok) return reportBlocked(around);
    if (around.kept.length) console.log(`[sync] merged around ${around.kept.length} uncommitted file(s), their edits kept on top: ${around.kept.join(", ")}`);
    if (around.raced.length) console.error(`[sync] ${around.raced.join(", ")} changed while syncing; left as the other session wrote it. git diff shows origin's change undone there.`);
  }
  const after = tryGit(["rev-parse", "--short", "HEAD"], main).out.trim();
  if (before === after) {
    console.log(`[sync] ${INTEGRATION_BRANCH} already at ${after}.`);
    return 0;
  }
  console.log(`✓ ${INTEGRATION_BRANCH} ${before} → ${after}, up to origin — the dev server will pick it up.`);
  refreshDependencies(main, before, after);
  return 0;
}
