import { spawnSync } from "node:child_process";
import { INTEGRATION_BRANCH, LOCKFILES, mainCheckoutOf, tryGit } from "./settings.mjs";

const LOCK_RETRIES = 3;

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
    console.error(`[sync] package.json dropped ${removed.join(", ")}; not installing in the main checkout. Run pnpm install there by hand once no lane needs them.`);
    return;
  }
  console.log("[sync] the lockfile changed; running pnpm install in the main checkout");
  const result = spawnSync("pnpm", ["install"], { cwd: main, shell: process.platform === "win32", stdio: "inherit" });
  if (result.status !== 0) console.error(`[sync] pnpm install failed in ${main}; run it there by hand.`);
}

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
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
  const forward = () => tryGit(["merge", "--ff-only", `origin/${INTEGRATION_BRANCH}`], main);
  let result = forward();
  for (let i = 0; i < LOCK_RETRIES && !result.ok && /index\.lock|Unable to create|another git process/i.test(result.out); i += 1) {
    pause(400);
    result = forward();
  }
  if (!result.ok) {
    if (/would be overwritten by merge/i.test(result.out)) console.error(`[sync] the main checkout has local changes in the way; left untouched.\n${result.out.trim()}`);
    else if (/Not possible to fast-forward|diverging|non-fast-forward/i.test(result.out)) console.error(`[sync] ${INTEGRATION_BRANCH} in the main checkout has diverged from origin; left untouched.`);
    else console.error(`[sync] could not fast-forward ${INTEGRATION_BRANCH}; left untouched.\n${result.out.trim()}`);
    return 0;
  }
  const after = tryGit(["rev-parse", "--short", "HEAD"], main).out.trim();
  if (before === after) {
    console.log(`[sync] ${INTEGRATION_BRANCH} already at ${after}.`);
    return 0;
  }
  console.log(`✓ fast-forwarded ${INTEGRATION_BRANCH} ${before} → ${after} — the dev server will pick it up.`);
  refreshDependencies(main, before, after);
  return 0;
}
