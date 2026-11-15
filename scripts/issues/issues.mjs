#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readAll } from "../tasks/taskRepo.mjs";
import { LIST_FIELDS, REPO, VIEW_FIELDS, listLines, parseArgs, tasksByIssue, viewLines } from "./issueFormat.mjs";

function gh(args) {
  return JSON.parse(execFileSync("gh", [...args, "--repo", REPO], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const byIssue = tasksByIssue(readAll(process.cwd()));
  if (options.numbers.length) {
    const issues = options.numbers.map((number) => gh(["issue", "view", String(number), "--json", VIEW_FIELDS]));
    if (options.json) {
      const rows = issues.map((issue) => ({ ...issue, tasks: (byIssue.get(issue.number) ?? []).map((task) => task.fields) }));
      console.log(JSON.stringify(rows.length === 1 ? rows[0] : rows, null, 2));
      return;
    }
    console.log(issues.map((issue) => viewLines(issue, byIssue.get(issue.number)).join("\n")).join("\n\n---\n\n"));
    return;
  }
  const issues = gh(["issue", "list", "--state", options.state, "--limit", String(options.limit), "--json", LIST_FIELDS]);
  if (options.json) {
    const rows = issues
      .filter((issue) => !options.untracked || !byIssue.has(issue.number))
      .map((issue) => ({ ...issue, tasks: (byIssue.get(issue.number) ?? []).map((task) => task.fields) }));
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  console.log(listLines(issues, byIssue, options).join("\n"));
}

try {
  main();
} catch (error) {
  console.error(`[issues] ${error.message}`);
  process.exit(1);
}
