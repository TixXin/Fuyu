import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { channelProblems, readTasks, RELEASED_MARKER, releasedComment, shippedIssues } from "./after-release.mjs";
import { commandLine } from "./command-line.mjs";
import { BETA_CHANNEL_TAG, isPrerelease, shouldUpdateBetaManifest } from "./channel.mjs";
import { baseTag, DRAFT_MARKER } from "./notes-draft.mjs";
import { readVersion, VERSION_FILES } from "./versions.mjs";
import { msiNames, msiVersion } from "./msi-version.mjs";
import { loadSigningEnvironment } from "./release-signing.mjs";
import { smokeTest } from "./smoke-test.mjs";
import { EXE_NAME, installExe, takeLock } from "../build-exe.mjs";
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
const PUBLISH_LOCK = join(PUBLISH_TARGET, ".release.lock");
const REPO = "TixXin/fuyu";

const args = process.argv.slice(2);
const baseFlag = args.indexOf("--base-url");
const baseUrl = baseFlag >= 0 ? args[baseFlag + 1] : "";
const upload = !args.includes("--no-upload");
const issueComments = !args.includes("--no-issue-comments");
const smoke = !args.includes("--no-smoke-test");

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
const notesFile = `docs/releases/${tag}.md`;
if (!existsSync(notesFile)) fail(`Missing release notes: ${notesFile}`);
if (readFileSync(notesFile, "utf8").includes(DRAFT_MARKER)) {
  fail(`${notesFile} is still the draft pnpm release:version wrote: rewrite it for users and delete the draft marker.`);
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
  const dirty = run("git", ["status", "--porcelain"], { capture: true }).stdout;
  if (dirty.trim()) fail(`Working tree has uncommitted changes:\n${dirty}`);
  const auth = run("gh", ["auth", "status"], { capture: true, allowFailure: true });
  if (auth.status !== 0) fail("gh is not authenticated. Run `gh auth login` first.");
  const existing = run("gh", ["release", "view", tag, "--repo", REPO], { capture: true, allowFailure: true });
  if (existing.status === 0) fail(`Release ${tag} already exists. Bump the version instead of replacing published update packages.`);
}

takeLock(PUBLISH_LOCK);
process.on("exit", () => rmSync(PUBLISH_LOCK, { force: true }));
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

const latestArgs = ["scripts/release/make-latest-json.mjs", "--notes-file", notesFile, "--release-dir", RELEASE_DIR];
if (baseUrl) latestArgs.push("--base-url", baseUrl);
run("node", latestArgs);

const installer = readdirSync(BUNDLE_DIR).find((name) => name.endsWith(`_${version}_x64-setup.exe`));
if (!installer) fail(`Missing installer in ${BUNDLE_DIR}.`);
const msi = readdirSync(MSI_DIR).find((name) => msiNames(version).some((suffix) => name.endsWith(suffix)));
if (!msi) fail(`Missing MSI installer in ${MSI_DIR}.`);
const installers = [`${BUNDLE_DIR}/${installer}`, `${MSI_DIR}/${msi}`];
const checksumPath = `${BUNDLE_DIR}/SHA256SUMS.txt`;
writeFileSync(checksumPath, installers.map((path) =>
  `${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${basename(path)}`,
).join("\n") + "\n");

if (!upload) {
  console.log(`\n✓ Built v${version}. NSIS: ${BUNDLE_DIR}; MSI: ${MSI_DIR} (--no-upload).`);
  process.exit(0);
}

const assets = [...installers, ...installers.map((path) => `${path}.sig`), `${BUNDLE_DIR}/latest.json`, checksumPath];
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
if (smoke) {
  const problem = smokeTest(run, tag, REPO);
  if (problem) fail(`${problem}\nThe release remains a draft; fix it and release a new version, or delete the draft.`);
  console.log("✓ The installer installs and starts on a clean Windows runner.");
}
run("gh", [
  "release", "edit", tag, "--repo", REPO, "--draft=false",
  ...(prerelease ? ["--prerelease", "--latest=false"] : ["--latest"]),
]);
console.log(`\n✓ Published ${tag}${prerelease ? " as a pre-release (beta channel only)" : ""}.`);

installLocally();

updateBetaChannel(revision);
verifyChannels();
if (issueComments) tellShippedIssues(revision);

function installLocally() {
  try {
    const exe = installExe(EXE);
    console.log(`✓ This machine now runs ${tag}: ${exe}`);
  } catch (error) {
    console.error(`  Could not put ${tag}'s exe in place (${error.message}); run pnpm build:exe instead.`);
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
    return;
  }
  run("gh", ["release", "upload", BETA_CHANNEL_TAG, `${BUNDLE_DIR}/latest.json`, "--repo", REPO, "--clobber"]);
  console.log(`✓ Beta channel now offers ${tag}.`);
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
  console.log(`✓ Channels read back: stable offers ${prerelease ? "the last final release" : tag}, beta offers ${tag}.`);
}

function tellShippedIssues(target) {
  run("git", ["fetch", "--quiet", "--tags", "origin"], { allowFailure: true });
  const tags = run("git", ["tag", "--list", "v*"], { capture: true }).stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const base = baseTag(version, tags);
  const log = run("git", ["log", "--no-merges", "--format=%H%x09%s", base ? `${base}..${target}` : target], { capture: true }).stdout;
  const commits = log.split("\n").filter(Boolean).map((line) => {
    const [hash, ...subject] = line.split("\t");
    return { hash, subject: subject.join("\t") };
  });
  const shipped = shippedIssues(readTasks(), commits);
  const url = `https://github.com/${REPO}/releases/tag/${tag}`;
  const dir = join(CHECK_DIR, "comments");
  mkdirSync(dir, { recursive: true });
  for (const [issue, tasks] of shipped) {
    const existing = run("gh", ["api", `repos/${REPO}/issues/${issue}/comments`, "--paginate", "--jq", ".[].body"], { capture: true, allowFailure: true });
    if (existing.status !== 0) {
      console.log(`  #${issue}: could not read its comments, so it was not told.`);
      continue;
    }
    if (existing.stdout.includes(RELEASED_MARKER(tag))) continue;
    const body = join(dir, `${issue}.md`);
    writeFileSync(body, releasedComment({ tag, url, tasks, repo: REPO }));
    const posted = run("gh", ["issue", "comment", String(issue), "--repo", REPO, "--body-file", body], { capture: true, allowFailure: true });
    console.log(posted.status === 0 ? `✓ Told #${issue} that it shipped in ${tag}.` : `  #${issue}: the comment failed: ${posted.stderr.trim()}`);
  }
  if (shipped.size === 0) console.log(`No GitHub issue has a task with a commit in ${tag}.`);
}
