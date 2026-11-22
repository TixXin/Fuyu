import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { channelProblems, finishedIssues, readTasks, shippedIssues, tellIssues } from "./after-release.mjs";
import { commandLine } from "./command-line.mjs";
import { BETA_CHANNEL_TAG, isPrerelease, shouldUpdateBetaManifest } from "./channel.mjs";
import { baseTag, downloadLinks, DRAFT_MARKER } from "./notes-draft.mjs";
import { readVersion, VERSION_FILES } from "./versions.mjs";
import { msiNames, msiVersion } from "./msi-version.mjs";
import { loadSigningEnvironment } from "./release-signing.mjs";
import { smokeTest } from "./smoke-test.mjs";
import { finishMacBuild, macFiles, startMacBuild } from "./mac-build.mjs";
import { finishWindowsBuild, startWindowsBuild } from "./windows-build.mjs";
import { forgetPrebuild, matchingPrebuild, readPrebuild } from "./prebuild.mjs";
import { forgetPrefetch, PLATFORMS, prefetchSummary, readyPrefetch, takePrefetched } from "./prefetch.mjs";
import { releaseClock } from "./timing.mjs";
import { publishToSite, siteDown } from "./site-import.mjs";
import { createNotifier } from "./notify.mjs";
import { EXE_NAME, installExe, lockHeld, takeLock } from "../build-exe.mjs";
import { mainCheckout, PUBLISH_DIR, targetDir } from "../build-dirs.mjs";

const CONFIG = "src-tauri/tauri.conf.json";
const OVERLAY = "src-tauri/tauri.release.conf.json";
const PUBLISH_TARGET = targetDir(mainCheckout(), PUBLISH_DIR);
const RELEASE_DIR = join(PUBLISH_TARGET, "release");
const BUNDLE_DIR = join(RELEASE_DIR, "bundle", "nsis");
const MSI_DIR = join(RELEASE_DIR, "bundle", "msi");
const EXE = join(RELEASE_DIR, EXE_NAME);
const MSI_OVERLAY = join(RELEASE_DIR, "msi-version.conf.json");
const BETA_CHANNEL_DIR = join(RELEASE_DIR, "beta-channel");
const CHECK_DIR = join(RELEASE_DIR, "channel-check");
const MAC_DIR = join(RELEASE_DIR, "macos");
const PUBLISH_LOCK = join(PUBLISH_TARGET, ".release.lock");
const REPO = "TixXin/fuyu";

const args = process.argv.slice(2);
const baseFlag = args.indexOf("--base-url");
const baseUrl = baseFlag >= 0 ? args[baseFlag + 1] : "";
const upload = !args.includes("--no-upload");
const issueComments = !args.includes("--no-issue-comments");
const smoke = !args.includes("--no-smoke-test");
const withMac = upload && !args.includes("--no-mac");
const local = args.includes("--local");
const shareImage = !args.includes("--no-share-image");
const usePrebuild = !args.includes("--no-prebuild");
const toSite = !args.includes("--no-site");
let notify = null;
process.on("exit", (code) => {
  const table = releaseClock.table();
  for (const line of table) console.log(line);
  if (!notify) return;
  if (code === 0) notify.finished(table.length ? `${table.at(-1).trim()}` : "Done.");
  else notify.problem(`pnpm release stopped with exit code ${code}; see the log.`);
});

if (baseFlag >= 0 && (!baseUrl || !URL.canParse(baseUrl) || new URL(baseUrl).protocol !== "https:")) {
  fail("--base-url requires a valid HTTPS URL.");
}
try {
  Object.assign(process.env, loadSigningEnvironment());
} catch (error) {
  fail(error.message);
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  notify?.problem(message);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? commandLine(command, commandArgs) : command, windows ? [] : commandArgs, {
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
    shell: windows,
    windowsHide: true,
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  if (result.error) fail(`${command} failed: ${result.error.message}`);
  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

const versions = Object.entries(VERSION_FILES).map(([kind, path]) => [path, readVersion(kind, readFileSync(path, "utf8"))]);
const version = versions.find(([path]) => path === CONFIG)[1];
if (!version || versions.some(([, found]) => found !== version)) {
  fail(
    `Version mismatch: ${versions.map(([path, found]) => `${path}=${found}`).join(", ")}.\n` +
      "Set them together with pnpm release:version <version>.",
  );
}

const tag = `v${version}`;
if (upload) {
  notify = createNotifier({ prefix: `Fuyu ${tag} · ` });
  releaseClock.listen((line) => notify.step(line));
  console.log(notify.enabled ? "Phone notices go to Bark." : "Bark is not set up on this machine (see docs/features/updater.md); no phone notices.");
  notify.step(`Releasing ${tag}.`);
}
const notesFile = `docs/releases/${tag}.md`;
if (!existsSync(notesFile)) fail(`Missing release notes: ${notesFile}`);
if (readFileSync(notesFile, "utf8").includes(DRAFT_MARKER)) {
  fail(`${notesFile} is still the draft pnpm release:version wrote: rewrite it for users and delete the draft marker.`);
}
const links = downloadLinks(version);
const notesText = readFileSync(notesFile, "utf8");
if (!notesText.includes(links.zh) || !notesText.includes(links.en)) {
  fail(`${notesFile} must open both halves with the download links pnpm release:version wrote:\n${links.zh}\n${links.en}`);
}

if (!process.env.TAURI_UPDATER_PUBKEY?.trim()) {
  fail("TAURI_UPDATER_PUBKEY is not set; the built app would reject every update.");
}
if (!process.env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
  fail("TAURI_SIGNING_PRIVATE_KEY is not set; cannot sign the updater artifacts.");
}
if (process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined) {
  fail(
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set. Use an empty string for keys without a password,\n" +
      'otherwise the build waits for interactive input: $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""',
  );
}

if (upload) {
  const watched = local ? [] : ["--", ...Object.values(VERSION_FILES), notesFile];
  const dirty = run("git", ["status", "--porcelain", ...watched], { capture: true }).stdout;
  if (dirty.trim()) fail(`Working tree has uncommitted changes${local ? "" : " to the version or the notes"}:\n${dirty}`);
  const auth = run("gh", ["auth", "status"], { capture: true, allowFailure: true });
  if (auth.status !== 0) fail("gh is not authenticated. Run `gh auth login` first.");
  const existing = run("gh", ["release", "view", tag, "--repo", REPO], { capture: true, allowFailure: true });
  if (existing.status === 0) fail(`Release ${tag} already exists. Bump the version instead of replacing published update packages.`);
  let holder = null;
  try {
    holder = JSON.parse(readFileSync(PUBLISH_LOCK, "utf8"));
  } catch {
  }
  if (lockHeld(holder)) fail(`Another pnpm release (pid ${holder.pid}) has been running since ${new Date(holder.since).toLocaleTimeString()}. Let it finish, or stop it first; two releases at once would publish twice.`);
  const down = toSite ? await siteDown() : null;
  if (down) {
    console.error(`\n! ${down}`);
    notify?.problem(down);
  }
}

let macBuild = null;
let windowsBuild = null;
let prebuilt = null;
if (withMac || !local) {
  const revision = run("git", ["rev-parse", "HEAD"], { capture: true }).stdout.trim();
  const remote = run("git", ["branch", "-r", "--contains", revision], { capture: true, allowFailure: true }).stdout;
  if (!remote.includes("origin/")) fail(`${revision} is not on GitHub yet, so GitHub Actions cannot build it. Land it first, or pass --local --no-mac.`);
  const tree = run("git", ["rev-parse", "HEAD^{tree}"], { capture: true }).stdout.trim();
  prebuilt = usePrebuild ? matchingPrebuild(readPrebuild(), { version, tree }) : null;
  if (prebuilt) console.log(`Using the prebuild started at ${prebuilt.revision.slice(0, 8)}, which has the same files (pass --no-prebuild to build again).`);
  if (withMac) {
    macBuild = prebuilt?.mac ? { runId: prebuilt.mac } : startMacBuild(run, { repo: REPO, revision, version });
    if (macBuild.problem) fail(`${macBuild.problem}\nPass --no-mac to release Windows only.`);
  }
  if (!local) {
    windowsBuild = prebuilt ? { runId: prebuilt.windows } : startWindowsBuild(run, { repo: REPO, revision, version });
    if (windowsBuild.problem) fail(`${windowsBuild.problem}\nPass --local to build Windows on this machine.`);
  }
  if (!prebuilt) console.log(`Started on GitHub Actions: ${[windowsBuild && "Windows", macBuild && "macOS"].filter(Boolean).join(" and ")} build.`);
}

releaseClock.done("checks", "Version, notes, signing keys and GitHub are ready.");
takeLock(PUBLISH_LOCK);
process.on("exit", () => rmSync(PUBLISH_LOCK, { force: true }));
if (prebuilt) await readyPrefetch(prebuilt, [windowsBuild && "windows", macBuild && "mac"].filter(Boolean), { version });
if (windowsBuild && !takeAhead("windows", RELEASE_DIR)) {
  const problem = finishWindowsBuild(run, { repo: REPO, version, since: windowsBuild.since, runId: windowsBuild.runId, releaseDir: RELEASE_DIR });
  if (problem) fail(`${problem}\nNothing was published. Fix it, or pass --local to build Windows on this machine${windowsBuild.runId ? ", or --no-prebuild to build again" : ""}.`);
} else if (!windowsBuild) {
  buildLocally();
  releaseClock.done("Windows local build", "Built Windows on this machine.");
}

function takeAhead(platform, dest) {
  if (!Number.isInteger(prebuilt?.[platform])) return false;
  const { label } = PLATFORMS[platform];
  const taken = takePrefetched(platform, { record: prebuilt, version, dest });
  if (taken.problem) {
    console.log(`  Not using the ${label} build downloaded ahead: ${taken.problem}. Downloading it now.`);
    return false;
  }
  releaseClock.done(`${label} downloaded ahead`, `Using the ${label} build downloaded and signed ahead; its SHA-256 match. Back then:`);
  for (const line of prefetchSummary(taken.manifest)) console.log(line);
  return true;
}

function buildLocally() {
  run("node", ["scripts/release/prepare-release-config.mjs"]);
  const configs = ["--config", OVERLAY];
  let wixVersion;
  try {
    wixVersion = msiVersion(version);
  } catch (error) {
    fail(error.message);
  }
  if (wixVersion) {
    mkdirSync(dirname(MSI_OVERLAY), { recursive: true });
    writeFileSync(MSI_OVERLAY, `${JSON.stringify({ bundle: { windows: { wix: { version: wixVersion } } } })}\n`);
    configs.push("--config", MSI_OVERLAY);
    console.log(`MSI version for ${version}: ${wixVersion}`);
  }
  run("pnpm", ["tauri", "build", "--ci", ...configs, "--bundles", "nsis,msi"], { env: { CARGO_TARGET_DIR: PUBLISH_TARGET } });
}

if (macBuild && !takeAhead("mac", MAC_DIR)) {
  rmSync(MAC_DIR, { recursive: true, force: true });
  const problem = finishMacBuild(run, { repo: REPO, version, since: macBuild.since, runId: macBuild.runId, dir: MAC_DIR });
  if (problem) fail(`${problem}\nNothing was published. Fix it, or pass --no-mac to release Windows only.`);
}

const latestArgs = ["scripts/release/make-latest-json.mjs", "--notes-file", notesFile, "--release-dir", RELEASE_DIR];
if (macBuild) latestArgs.push("--mac-dir", MAC_DIR);
if (baseUrl) latestArgs.push("--base-url", baseUrl);
run("node", latestArgs);

const installer = readdirSync(BUNDLE_DIR).find((name) => name.endsWith(`_${version}_x64-setup.exe`));
if (!installer) fail(`Missing installer in ${BUNDLE_DIR}.`);
const msi = readdirSync(MSI_DIR).find((name) => msiNames(version).some((suffix) => name.endsWith(suffix)));
if (!msi) fail(`Missing MSI installer in ${MSI_DIR}.`);
const installers = [`${BUNDLE_DIR}/${installer}`, `${MSI_DIR}/${msi}`];
const mac = macBuild ? macFiles(MAC_DIR, version) : null;
const downloads = mac ? [...installers, mac.dmg] : installers;
const checksumPath = `${BUNDLE_DIR}/SHA256SUMS.txt`;
writeFileSync(checksumPath, downloads.map((path) =>
  `${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${basename(path)}`,
).join("\n") + "\n");
releaseClock.done("manifest", "latest.json and SHA256SUMS.txt are written.");

if (!upload) {
  console.log("");
  releaseClock.done("done", `Built v${version}. NSIS: ${BUNDLE_DIR}; MSI: ${MSI_DIR} (--no-upload).`);
  process.exit(0);
}

const assets = [
  ...installers, ...installers.map((path) => `${path}.sig`),
  ...(mac ? [mac.dmg, mac.archive, mac.signature] : []),
  `${BUNDLE_DIR}/latest.json`, checksumPath,
];
const revision = run("git", ["rev-parse", "HEAD"], { capture: true }).stdout.trim();
const prerelease = isPrerelease(version);
run("gh", [
  "release", "create", tag, "--repo", REPO, "--target", revision, "--draft",
  ...(prerelease ? ["--prerelease"] : []),
  "--title", tag, "--notes-file", notesFile, ...assets,
]);
const releaseId = run("gh", ["release", "view", tag, "--repo", REPO, "--json", "databaseId", "--jq", ".databaseId"], { capture: true }).stdout.trim();
const remote = JSON.parse(run("gh", ["api", `repos/${REPO}/releases/${releaseId}`], { capture: true }).stdout);
for (const path of assets) {
  const name = basename(path);
  const asset = remote.assets.find((entry) => entry.name === name);
  const digest = `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
  if (!asset || asset.state !== "uploaded" || asset.digest !== digest) {
    fail(`Uploaded asset verification failed for ${name}. The release remains a draft.`);
  }
}
releaseClock.done("upload", `The draft release has all ${assets.length} files and their SHA-256 match.`);
if (smoke) {
  const problem = smokeTest(run, tag, REPO);
  if (problem) fail(`${problem}\nThe release remains a draft; fix it and release a new version, or delete the draft.`);
  releaseClock.done("smoke test", "The installer installs and starts on a clean Windows runner.");
}
run("gh", [
  "release", "edit", tag, "--repo", REPO, "--draft=false",
  ...(prerelease ? ["--prerelease", "--latest=false"] : ["--latest"]),
]);
console.log("");
releaseClock.done("publish", `Published ${tag}${prerelease ? " as a pre-release (beta channel only)" : ""}.`);

forgetPrebuild();
forgetPrefetch();
installLocally();

updateBetaChannel(revision);
verifyChannels();
const siteProblems = toSite ? await publishToSite({ main: mainCheckout(), tag, version }) : [];
if (siteProblems.length === 0 && toSite) releaseClock.done("official site", `The official site offers ${tag}.`);
else releaseClock.mark("official site");
if (issueComments) await tellShippedIssues(revision);
releaseClock.mark("issue comments");
if (shareImage) renderShareImage();
releaseClock.mark("share image");
if (siteProblems.length > 0) {
  console.error(`\n✗ ${tag} is on GitHub, but the official site is behind:\n${siteProblems.join("\n")}`);
  process.exitCode = 1;
}

function renderShareImage() {
  const out = join(mainCheckout(), "src-tauri", "target", "release-share", tag);
  const push = Boolean(process.env.FUYU_BOT_INBOX);
  const result = run(process.execPath, [join("scripts", "release", "share-card.mjs"), version, "--out", out, ...(push ? ["--push"] : [])], { allowFailure: true });
  if (result.status !== 0) console.error(`  Could not render or push the share image for ${tag}; run pnpm release:share ${version} by hand.`);
  else if (!push) console.error(`\n! The share image was not pushed to the bot: FUYU_BOT_INBOX is not set on this machine (see bot/README.md). Set it, then run FUYU_BOT_INBOX=<host>:<inbox>/ pnpm release:share ${version} --push.`);
}

function installLocally() {
  try {
    const exe = installExe(EXE);
    releaseClock.done("install here", `This machine now runs ${tag}: ${exe}`);
  } catch (error) {
    console.error(`  Could not put ${tag}'s exe in place (${error.message}); run pnpm build:exe instead.`);
    releaseClock.mark("install here");
  }
}

function updateBetaChannel(target) {
  const dir = BETA_CHANNEL_DIR;
  mkdirSync(dir, { recursive: true });
  const exists = run("gh", ["release", "view", BETA_CHANNEL_TAG, "--repo", REPO], { capture: true, allowFailure: true });
  if (exists.status !== 0) {
    const notes = join(dir, "notes.md");
    writeFileSync(notes, "Update manifest of the beta channel, refreshed by every release. Do not delete.\n");
    run("gh", [
      "release", "create", BETA_CHANNEL_TAG, "--repo", REPO, "--target", target,
      "--prerelease", "--latest=false", "--title", BETA_CHANNEL_TAG, "--notes-file", notes,
    ]);
  }
  const current = run("gh", [
    "release", "download", BETA_CHANNEL_TAG, "--repo", REPO, "--pattern", "latest.json", "--dir", dir, "--clobber",
  ], { capture: true, allowFailure: true });
  const currentVersion = current.status === 0
    ? JSON.parse(readFileSync(join(dir, "latest.json"), "utf8")).version
    : null;
  if (!shouldUpdateBetaManifest(version, currentVersion)) {
    console.log(`Beta channel keeps v${currentVersion}, which is newer than ${tag}.`);
    releaseClock.mark("beta channel");
    return;
  }
  run("gh", ["release", "upload", BETA_CHANNEL_TAG, `${BUNDLE_DIR}/latest.json`, "--repo", REPO, "--clobber"]);
  releaseClock.done("beta channel", `Beta channel now offers ${tag}.`);
}

function verifyChannels() {
  const read = (name, tagArgs) => {
    const dir = join(CHECK_DIR, name);
    mkdirSync(dir, { recursive: true });
    const result = run("gh", ["release", "download", ...tagArgs, "--repo", REPO, "--pattern", "latest.json", "--dir", dir, "--clobber"], { capture: true, allowFailure: true });
    return result.status === 0 ? JSON.parse(readFileSync(join(dir, "latest.json"), "utf8")).version : null;
  };
  let problems = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    problems = channelProblems(version, { stable: read("stable", []), beta: read("beta", [BETA_CHANNEL_TAG]) });
    if (problems.length === 0) break;
  }
  if (problems.length > 0) {
    fail(`${tag} is published, but the update channels are off:\n${problems.join("\n")}\nSee "撤回有问题的版本" in docs/features/updater.md.`);
  }
  releaseClock.done("channels", `Channels read back: stable offers ${prerelease ? "the last final release" : tag}, beta offers ${tag}.`);
}

async function tellShippedIssues(target) {
  run("git", ["fetch", "--quiet", "--tags", "origin"], { allowFailure: true });
  const tags = run("git", ["tag", "--list", "v*"], { capture: true }).stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const base = baseTag(version, tags);
  const log = run("git", ["log", "--no-merges", "--format=%H%x09%s", base ? `${base}..${target}` : target], { capture: true }).stdout;
  const commits = log.split("\n").filter(Boolean).map((line) => {
    const [hash, ...subject] = line.split("\t");
    return { hash, subject: subject.join("\t") };
  });
  const tasks = readTasks();
  const shipped = shippedIssues(tasks, commits);
  const url = `https://github.com/${REPO}/releases/tag/${tag}`;
  const dir = join(CHECK_DIR, "comments");
  mkdirSync(dir, { recursive: true });
  for (const line of await tellIssues(shipped, { tag, url, repo: REPO, dir, finished: finishedIssues(tasks) })) console.log(line);
  if (shipped.size === 0) console.log(`No GitHub issue has a task with a commit in ${tag}.`);
}
