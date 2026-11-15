import { execFileSync } from "node:child_process";

const VIRTUAL_ID = "virtual:fuyu-release-dates";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const NOTE_FILE = /^docs\/releases\/v(\d+\.\d+\.\d+(?:-beta\.\d+)?)\.md$/;
const TAG = /^v(\d+\.\d+\.\d+(?:-beta\.\d+)?)\s+(\d{4}-\d{2}-\d{2})$/;

export function parseTagDates(output) {
  const dates = {};
  for (const line of output.split("\n")) {
    const match = line.trim().match(TAG);
    if (match) dates[match[1]] = match[2];
  }
  return dates;
}

export function parseAddedDates(output) {
  const dates = {};
  let date = null;
  for (const line of output.split("\n").map((value) => value.trim())) {
    if (line.startsWith("@")) date = line.slice(1);
    else if (date && NOTE_FILE.test(line)) dates[line.match(NOTE_FILE)[1]] = date;
  }
  return dates;
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

export function releaseDates(root) {
  try {
    const tags = parseTagDates(git(root, ["for-each-ref", "--format=%(refname:short) %(creatordate:short)", "refs/tags/v*"]));
    if (git(root, ["rev-parse", "--is-shallow-repository"]).trim() === "true") return tags;
    const added = parseAddedDates(git(root, ["log", "--diff-filter=A", "--format=@%cs", "--name-only", "--", "docs/releases"]));
    return { ...added, ...tags };
  } catch {
    return {};
  }
}

export function releaseDatesPlugin() {
  let root = process.cwd();
  return {
    name: "fuyu-release-dates",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(releaseDates(root))};`;
    },
  };
}
