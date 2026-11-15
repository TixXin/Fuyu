import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { VERSION, check, run } from "../src/index.mjs";
import { REVIEW_FIXTURES, capture, copyFixture, editJson, tempDir, writeFiles } from "./helpers.mjs";

test("help, version and bad arguments", async () => {
  const help = capture(tempDir());
  assert.equal(await run(["help"], help.io), 0);
  assert.match(help.stdout(), /Usage: fuyu-plugin <command>/);
  const version = capture(tempDir());
  assert.equal(await run(["version"], version.io), 0);
  assert.equal(version.stdout(), `${VERSION}\n`);
  const unknown = capture(tempDir());
  assert.equal(await run(["publish"], unknown.io), 2);
  assert.match(unknown.stderr(), /unknown command "publish"/);
  const flag = capture(tempDir());
  assert.equal(await run(["build", "--nope"], flag.io), 2);
  const config = copyFixture();
  writeFileSync(join(config, "market.json"), '{ "sandbox": true }\n');
  const bad = capture(config);
  assert.equal(await run(["build", "--config", "market.json"], bad.io), 2);
  assert.match(bad.stderr(), /unknown settings sandbox/);
});

test("build and pack from the plugin folder, with build settings from a file", async () => {
  const dir = copyFixture();
  writeFileSync(join(dir, "market.json"), '{ "packageDepth": 1 }\n');
  const built = capture(dir);
  assert.equal(await run(["build", "--config", "market.json"], built.io), 0);
  assert.match(built.stdout(), /built @someone\/fuyu-hello 1\.0\.0 into build[/\\]package/);
  assert.match(built.stdout(), /nodeApis: os/);
  assert.match(readFileSync(join(dir, "build", "package", "dist", "island.js"), "utf8"), /from "\.\.\/\.\.\/__shared\/react\.js"/);
  const packed = capture(dir);
  assert.equal(await run(["pack", "--out", "out/hello.fuyu"], packed.io), 0);
  assert.ok(existsSync(join(dir, "out", "hello.fuyu")));
  assert.match(packed.stdout(), /digest: [0-9a-f]{64}/);
});

test("build reports manifest errors with their paths and fails", async () => {
  const dir = copyFixture("hello", (root) => editJson(join(root, "package.json"), (pkg) => delete pkg.license));
  const out = capture(dir);
  assert.equal(await run(["build"], out.io), 1);
  assert.match(out.stderr(), /error: package\.json has errors/);
  assert.match(out.stderr(), /error: license: license is required/);
});

test("check passes hello, and reports what the market would refuse", async () => {
  const clean = await check(copyFixture());
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.warnings, []);
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/host.ts": `import { exec } from "node:child_process";\n${readFileSync(join(root, "src/host.ts"), "utf8")}\nexport const run = () => exec("curl https://collect.weather-stats.net");\nconst _0x1a2b = ["a"]; const _0x3c4d = _0x1a2b; const _0x5e6f = _0x3c4d; export { _0x5e6f };\n`,
    });
    editJson(join(root, "package.json"), (pkg) => (pkg.fuyu.experimental = ["timers/v1"]));
  });
  const result = await check(dir, { allowExperimental: false });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "experimental"));
  const lax = await check(dir);
  assert.ok(lax.errors.some((issue) => issue.code === "review:obfuscation"), JSON.stringify(lax.errors));
  assert.ok(lax.errors.some((issue) => issue.code === "review:manifest"));
  assert.ok(lax.warnings.some((issue) => issue.code === "undeclared-domain"));
  assert.ok(lax.warnings.some((issue) => issue.code === "review:sensitive"));
  const json = capture(dir);
  assert.equal(await run(["check", "--json"], json.io), 1);
  assert.equal(JSON.parse(json.stdout()).ok, false);
});

test("review prints Markdown or JSON and exits 1 only on red", async () => {
  const fixture = (version) => join(REVIEW_FIXTURES, `weather-${version}`);
  const markdown = capture(tempDir());
  assert.equal(await run(["review", fixture("1.0.0"), fixture("1.1.0")], markdown.io), 0);
  assert.match(markdown.stdout(), /^## 插件审核：🟡/);
  const json = capture(tempDir());
  assert.equal(await run(["review", "-", fixture("1.0.1"), "--format", "json", "--markdown", "report.md"], json.io), 0);
  assert.equal(JSON.parse(json.stdout()).firstRelease, true);
  assert.ok(existsSync(join(json.io.cwd, "report.md")));
  const usage = capture(tempDir());
  assert.equal(await run(["review", fixture("1.0.0")], usage.io), 2);
});
