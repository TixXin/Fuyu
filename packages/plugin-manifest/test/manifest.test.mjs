import assert from "node:assert/strict";
import { test } from "node:test";
import { manifestSchema, parseRepository, validateManifest } from "@fuyu/plugin-manifest";
import { samplePackage, withApp } from "./fixtures.mjs";

const codes = (result) => result.errors.map((issue) => `${issue.path}:${issue.code}`);
const warningCodes = (result) => result.warnings.map((issue) => `${issue.path}:${issue.code}`);
const fails = (pkg, expected, options) => {
  const result = validateManifest(pkg, options);
  assert.equal(result.ok, false, `expected ${expected} to fail`);
  assert.ok(codes(result).includes(expected), `${expected} not in ${codes(result).join(", ")}`);
  assert.equal(result.manifest, null);
};

test("the full example from the design passes without warnings", () => {
  const result = validateManifest(samplePackage());
  assert.deepEqual(codes(result), []);
  assert.deepEqual(warningCodes(result), []);
});

test("npm fields: required, type module, semver version, license and repository", () => {
  for (const key of ["name", "version", "license", "repository"]) {
    const pkg = samplePackage();
    delete pkg[key];
    fails(pkg, `${key}:required`);
  }
  fails({ ...samplePackage(), type: "commonjs" }, "type:module");
  fails({ ...samplePackage(), version: "1.2" }, "version:semver");
  fails({ ...samplePackage(), version: "v1.2.0" }, "version:semver");
  fails({ ...samplePackage(), license: "UNLICENSED" }, "license:license");
  fails({ ...samplePackage(), repository: "not a repo" }, "repository:repository");
  assert.equal(validateManifest({ ...samplePackage(), version: "1.2.0-beta.1" }).ok, true);
});

test("engines.fuyu is required, must be a range and can be checked against the app version", () => {
  fails({ ...samplePackage(), engines: {} }, "engines.fuyu:required");
  fails({ ...samplePackage(), engines: { fuyu: "soon" } }, "engines.fuyu:range");
  fails(samplePackage(), "engines.fuyu:engine", { appVersion: "0.3.9" });
  assert.equal(validateManifest(samplePackage(), { appVersion: "0.5.0" }).ok, true);
});

test("a beta app build is compared by its ordering, so a newer beta fits an older range", () => {
  const needs0310 = { ...samplePackage(), engines: { fuyu: ">=0.3.10" } };
  assert.equal(validateManifest(needs0310, { appVersion: "0.3.11-beta.4" }).ok, true);
  fails(needs0310, "engines.fuyu:engine", { appVersion: "0.3.10-beta.1" });
  fails({ ...samplePackage(), engines: { fuyu: ">=0.3.11" } }, "engines.fuyu:engine", { appVersion: "0.3.11-beta.4" });
});

test("third-party names are @<repository owner>/<name>, compared without case", () => {
  fails({ ...samplePackage(), name: "fuyu-weather" }, "name:name-unscoped");
  fails({ ...samplePackage(), name: "@other/weather" }, "name:name-owner");
  fails({ ...samplePackage(), name: "@Someone/weather" }, "name:name");
  assert.equal(validateManifest({ ...samplePackage(), repository: "https://github.com/SomeOne/fuyu-weather.git" }).ok, true);
  assert.equal(validateManifest({ ...samplePackage(), repository: { type: "git", url: "git+https://github.com/someone/x.git" } }).ok, true);
  assert.equal(validateManifest({ ...samplePackage(), name: "@someone/weather" }).ok, true);
});

test("@fuyu/* is reserved for official plugins; the scope is configurable", () => {
  const official = { ...samplePackage(), name: "@fuyu/weather", repository: "github:TixXin/fuyu" };
  fails(official, "name:name-reserved");
  fails({ ...official, name: "@FUYU/weather" }, "name:name");
  assert.equal(validateManifest(official, { official: true }).ok, true);
  assert.equal(validateManifest({ ...official, name: "@atoll/weather" }, { official: true, officialScope: "atoll" }).ok, true);
  fails({ ...official, name: "@atoll/weather" }, "name:name-reserved", { officialScope: "atoll" });
});

test("the app section: required fields and locales", () => {
  for (const key of ["displayName", "description", "icon", "categories"]) fails(withApp((app) => delete app[key]), `fuyu.${key}:required`);
  fails(withApp((app) => (app.manifest = 2)), "fuyu.manifest:manifest");
  fails(withApp((app) => (app.displayName = { en: "Weather" })), "fuyu.displayName.zh-CN:required");
  fails(withApp((app) => (app.displayName = "Weather")), "fuyu.displayName:localized");
  fails(withApp((app) => (app.icon = "assets/icon.gif")), "fuyu.icon:path");
  fails(withApp((app) => (app.categories = ["games"])), "fuyu.categories[0]:type");
  fails(withApp((app) => (app.categories = [])), "fuyu.categories:required");
  assert.equal(validateManifest(withApp((app) => (app.categories = ["games"])), { categories: ["games"] }).ok, true);
});

test("the app section: entries are relative paths inside the package", () => {
  for (const bad of ["../host.js", "/abs/host.js", "dist\\host.js", "C:/host.js", "dist//host.js", "./dist/host.js"]) {
    fails(withApp((app) => (app.host = bad)), "fuyu.host:path");
  }
  fails(withApp((app) => (app.client = { island: "../x.js" })), "fuyu.client.island:path");
  fails(withApp((app) => (app.config = "dist/config.yaml")), "fuyu.config:path");
});

test("the app section: lists, requires, commands, screenshots, network, platforms", () => {
  fails(withApp((app) => (app.slots = "island.page/v1")), "fuyu.slots:type");
  fails(withApp((app) => (app.requires = { weather: "^1" })), "requires.weather:name");
  fails(withApp((app) => (app.requires = { "@fuyu/location": "latest" })), "requires.@fuyu/location:range");
  fails(withApp((app) => app.commands.push({ ...app.commands[0] })), "fuyu.commands[1].id:duplicate");
  fails(withApp((app) => (app.commands = [{ id: "x" }])), "fuyu.commands[0].title:required");
  fails(withApp((app) => (app.screenshots = Array.from({ length: 7 }, () => ({ path: "a.png" })))), "fuyu.screenshots:too-many");
  fails(withApp((app) => (app.network = ["https://api.example.com"])), "fuyu.network[0]:type");
  fails(withApp((app) => (app.platforms = ["android"])), "fuyu.platforms[0]:type");
  fails(withApp((app) => (app.preview = "yes")), "fuyu.preview:type");
  assert.equal(validateManifest(withApp((app) => (app.network = ["*.example.com", "localhost"]))).ok, true);
});

test("experimental interfaces are refused when the caller says so", () => {
  const pkg = withApp((app) => (app.experimental = ["island.page/v2"]));
  assert.equal(validateManifest(pkg).ok, true);
  fails(pkg, "fuyu.experimental:experimental", { allowExperimental: false });
});

test("nodeApis and builtWith written by hand in the source give warnings", () => {
  const source = validateManifest(samplePackage(), { stage: "source" });
  assert.equal(source.ok, true);
  assert.deepEqual(warningCodes(source), ["fuyu.nodeApis:generated", "fuyu.builtWith:generated"]);
  fails(withApp((app) => (app.builtWith = "latest")), "fuyu.builtWith:semver");
});

test("unknown fields give warnings, not errors", () => {
  const pkg = withApp((app, root) => {
    app.theme = "dark";
    app.commands[0].when = "always";
    root.island = true;
    root.scripts = { build: "x" };
  });
  const result = validateManifest(pkg);
  assert.equal(result.ok, true);
  assert.deepEqual(warningCodes(result), ["island:unknown", "fuyu.commands[0].when:unknown", "fuyu.theme:unknown"]);
});

test("a configured app key moves both the section and engines", () => {
  assert.equal(validateManifest(samplePackage("atoll"), { appKey: "atoll" }).ok, true);
  fails(samplePackage("atoll"), "fuyu:required");
});

test("parseRepository reads the usual repository spellings", () => {
  const owner = (value) => parseRepository(value)?.owner ?? null;
  assert.equal(owner("someone/repo"), "someone");
  assert.equal(owner("github:someone/repo"), "someone");
  assert.equal(owner("gitlab:group/repo"), "group");
  assert.equal(owner("git@github.com:someone/repo.git"), "someone");
  assert.equal(owner("https://github.com/someone/repo"), "someone");
  assert.equal(owner({ url: "git+ssh://git@github.com/someone/repo.git" }), "someone");
  assert.equal(owner("file:///tmp/repo"), null);
  assert.equal(owner(""), null);
});

test("the JSON Schema lists the required fields under the configured key", () => {
  const schema = manifestSchema({ appKey: "atoll" });
  assert.ok(schema.required.includes("atoll"));
  assert.deepEqual(schema.properties.engines.required, ["atoll"]);
  assert.deepEqual(schema.properties.atoll.required, ["manifest", "displayName", "description", "icon", "categories"]);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(manifestSchema())));
  const pathPattern = new RegExp(schema.properties.atoll.properties.host.pattern);
  assert.equal(pathPattern.test("dist/host.js"), true);
  for (const bad of ["../x.js", "/x.js", "a/./b.js", "a\\b.js"]) assert.equal(pathPattern.test(bad), false, bad);
});
