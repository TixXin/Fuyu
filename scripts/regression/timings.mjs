#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageKey, TIMINGS_FILE } from "./shards.mjs";

const REPO = "TixXin/fuyu";
const PAGE_LINE = /^(?:\S+Z )?[✓✗] (\S+)\s+[^,]+, \d+ checks, ([\d.]+)s$/;

export function pageSeconds(logs) {
  const samples = {};
  for (const log of logs) {
    for (const line of log.split(/\r?\n/)) {
      const match = PAGE_LINE.exec(line.trim());
      if (match) (samples[pageKey(match[1])] ??= []).push(Number(match[2]));
    }
  }
  const seconds = {};
  for (const page of Object.keys(samples).sort()) {
    const values = samples[page];
    seconds[page] = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }
  return seconds;
}

function gh(args) {
  const result = spawnSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`gh ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function regressionLogs(run) {
  const jobs = JSON.parse(gh(["run", "view", run, "--repo", REPO, "--json", "jobs"])).jobs;
  return jobs.filter((job) => job.name.startsWith("regression")).map((job) => gh(["api", `repos/${REPO}/actions/jobs/${job.databaseId}/logs`]));
}

function main(runs) {
  if (!runs.length) {
    console.error("Usage: node scripts/regression/timings.mjs <CI run id…>");
    return 2;
  }
  const seconds = pageSeconds(runs.flatMap(regressionLogs));
  if (!Object.keys(seconds).length) {
    console.error("No regression page lines in those runs.");
    return 1;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  writeFileSync(path.join(root, TIMINGS_FILE), `${JSON.stringify({ source: `CI regression jobs, Windows runner, run ${runs.join(" and ")}`, seconds }, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(seconds).length} pages to ${TIMINGS_FILE}.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
