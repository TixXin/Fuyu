import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, isPrerelease, shouldUpdateBetaManifest } from "../../scripts/release/channel.mjs";
import { siteChannelProblems, siteCheckout } from "../../scripts/release/site-import.mjs";

test("pre-releases are told apart from final releases", () => {
  assert.equal(isPrerelease("0.3.1-beta.1"), true);
  assert.equal(isPrerelease("0.3.1"), false);
});

test("versions compare by semver precedence", () => {
  const ordered = ["0.3.0", "0.3.1-alpha", "0.3.1-beta.1", "0.3.1-beta.2", "0.3.1-beta.10", "0.3.1", "0.3.2-beta.1", "0.4.0"];
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(compareVersions(ordered[i - 1], ordered[i]) < 0, `${ordered[i - 1]} < ${ordered[i]}`);
    assert.ok(compareVersions(ordered[i], ordered[i - 1]) > 0, `${ordered[i]} > ${ordered[i - 1]}`);
  }
  assert.equal(compareVersions("0.3.1-beta.1", "0.3.1-beta.1"), 0);
  assert.throws(() => compareVersions("v0.3.1", "0.3.1"));
});

test("the beta manifest only moves forward", () => {
  assert.equal(shouldUpdateBetaManifest("0.3.1-beta.1", null), true);
  assert.equal(shouldUpdateBetaManifest("0.3.1", "0.3.1-beta.2"), true);
  assert.equal(shouldUpdateBetaManifest("0.3.1", "0.3.2-beta.1"), false);
});

const siteFetch = (versions) => async (url) => {
  const channel = /\/api\/update\/(\w+)\/latest\.json$/.exec(url)?.[1];
  const version = versions[channel];
  return version === undefined ? { ok: false } : { ok: true, json: async () => ({ version }) };
};

test("the official site lagging behind a published beta is reported", async () => {
  const problems = await siteChannelProblems("0.3.12-beta.3", siteFetch({ stable: "0.3.11", beta: "0.3.12-beta.1" }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /beta channel offers 0\.3\.12-beta\.1/);
});

test("the official site passes once both channels caught up, and an unreachable site does not", async () => {
  assert.deepEqual(await siteChannelProblems("0.3.12", siteFetch({ stable: "0.3.12", beta: "0.3.12" })), []);
  assert.deepEqual(await siteChannelProblems("0.3.12-beta.3", siteFetch({ stable: "0.3.11", beta: "0.3.12-beta.3" })), []);
  assert.equal((await siteChannelProblems("0.3.12", siteFetch({}))).length, 2);
});

test("the site checkout defaults to fuyu-desktop next to the app checkout", () => {
  assert.equal(siteCheckout("/x/projects/Fuyu", {}), "/x/projects/fuyu-desktop");
  assert.equal(siteCheckout("/x/projects/Fuyu", { FUYU_SITE_DIR: "/elsewhere" }), "/elsewhere");
});
