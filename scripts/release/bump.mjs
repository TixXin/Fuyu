import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { betaTags, mergeBetaNotes } from "./beta-notes.mjs";
import { baseTag, draftNotes } from "./notes-draft.mjs";
import { isPrerelease } from "./channel.mjs";
import { bumpProblem, VERSION_FILES, writeVersion } from "./versions.mjs";

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const version = process.argv[2]?.replace(/^v/, "");
if (!version) fail("Usage: pnpm release:version <version>, e.g. 0.3.4 or 0.3.4-beta.1");

git(["fetch", "--quiet", "--tags", "origin"]);
const tags = git(["tag", "--list", "v*"]).split("\n").map((tag) => tag.trim()).filter(Boolean);
const problem = bumpProblem(version, tags);
if (problem) fail(problem);

for (const [kind, path] of Object.entries(VERSION_FILES)) {
  try {
    writeFileSync(path, writeVersion(kind, readFileSync(path, "utf8"), version));
  } catch (error) {
    fail(error.message);
  }
  console.log(`✓ ${path} → ${version}`);
}

const notes = `docs/releases/v${version}.md`;
if (existsSync(notes)) {
  console.log(`  ${notes} exists; left as it is.`);
} else {
  const base = baseTag(version, tags);
  const betas = isPrerelease(version) ? [] : betaTags(version, tags).filter((tag) => existsSync(`docs/releases/${tag}.md`));
  const merged = mergeBetaNotes(betas.map((tag) => readFileSync(`docs/releases/${tag}.md`, "utf8")));
  const since = merged ? betas[0] : base;
  const range = since ? `${since}..HEAD` : "HEAD";
  const commits = git(["log", "--no-merges", "--format=%h%x09%s", range])
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, ...subject] = line.split("\t");
      return { hash, subject: subject.join("\t") };
    });
  writeFileSync(notes, draftNotes(version, base, commits, merged, since));
  if (merged) console.log(`✓ ${notes}: the notes of ${betas.join(", ")} merged in, and ${commits.length} commits since ${since}.`);
  else console.log(`✓ ${notes}: a draft with ${commits.length} commits since ${since ?? "the first commit"} to rewrite for users.`);
}
console.log("\nNext: rewrite the notes, commit, land, then run `pnpm release` from the same lane.");
