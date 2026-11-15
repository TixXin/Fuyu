import assert from "node:assert/strict";
import { cpSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { review } from "@fuyu/plugin-review";
import { reviewSources } from "../src/index.mjs";
import { REVIEW_FIXTURES, gitRepo, tempDir } from "./helpers.mjs";

const fixture = (version) => join(REVIEW_FIXTURES, `weather-${version}`);
const VERSIONS = ["1.0.1", "1.1.0", "1.2.0"];

test("review of folders gives the same tiers and findings as the review analyzer", () => {
  for (const version of VERSIONS) {
    const direct = review({ oldDir: fixture("1.0.0"), newDir: fixture(version) });
    const { report, markdown } = reviewSources({ oldSpec: fixture("1.0.0"), newSpec: fixture(version) });
    assert.equal(report.tier, direct.tier, version);
    assert.deepEqual(report.findings, direct.findings, version);
    assert.match(markdown, /^## 插件审核/);
  }
  assert.equal(reviewSources({ oldSpec: fixture("1.0.0"), newSpec: fixture("1.0.1") }).report.tier, "green");
  assert.notEqual(reviewSources({ oldSpec: fixture("1.0.0"), newSpec: fixture("1.1.0") }).report.tier, "green");
  const first = reviewSources({ oldSpec: "-", newSpec: fixture("1.0.0") });
  assert.equal(first.report.tier, "yellow");
  assert.equal(first.report.firstRelease, true);
});

test("review of git commits checks out the plugin folder at each commit", () => {
  const repo = tempDir("repo");
  const git = gitRepo(repo);
  const plugin = join(repo, "plugins", "weather");
  const commits = {};
  for (const version of ["1.0.0", ...VERSIONS]) {
    rmSync(plugin, { recursive: true, force: true });
    cpSync(fixture(version), plugin, { recursive: true });
    for (const file of readdirSync(plugin, { recursive: true })) utimesSync(join(plugin, file), 1e9, 1e9);
    commits[version] = git.commit(version);
  }
  for (const version of VERSIONS) {
    const direct = review({ oldDir: fixture("1.0.0"), newDir: fixture(version) });
    const { report, sources } = reviewSources({ oldSpec: commits["1.0.0"], newSpec: commits[version], repo: plugin });
    assert.equal(report.tier, direct.tier, version);
    assert.deepEqual(report.summary.nodeApis, direct.summary.nodeApis);
    assert.equal(sources.new.commit, commits[version]);
  }
  const mixed = reviewSources({ oldSpec: "HEAD~3", newSpec: fixture("1.1.0"), repo, path: "plugins/weather" });
  assert.equal(mixed.report.tier, review({ oldDir: fixture("1.0.0"), newDir: fixture("1.1.0") }).tier);
  assert.throws(() => reviewSources({ oldSpec: "no-such-thing", newSpec: fixture("1.0.1"), repo }), /neither a folder nor a commit/);
});
