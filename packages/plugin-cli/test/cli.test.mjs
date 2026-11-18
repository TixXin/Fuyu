import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { VERSION, check, dev, run } from "../src/index.mjs";
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
  writeFileSync(join(dir, "market.json"), '{ "packageDepth": true }\n');
  const built = capture(dir);
  assert.equal(await run(["build", "--config", "market.json"], built.io), 0);
  assert.match(built.stdout(), /built @someone\/fuyu-hello 1\.0\.0 into build[/\\]package/);
  assert.match(built.stdout(), /nodeApis: os/);
  assert.match(readFileSync(join(dir, "build", "package", "dist", "island.js"), "utf8"), /from "\.\.\/\.\.\/\.\.\/\.\.\/__shared\/react\.js"/);
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
  assert.ok(!lax.errors.some((issue) => issue.code === "review:manifest"), JSON.stringify(lax.errors));
  assert.ok(lax.warnings.some((issue) => issue.code === "undeclared-domain"));
  assert.ok(lax.warnings.some((issue) => issue.code === "review:sensitive"));
  const json = capture(dir);
  assert.equal(await run(["check", "--json"], json.io), 1);
  assert.equal(JSON.parse(json.stdout()).ok, false);
});

const experimental = () => copyFixture("hello", (root) => editJson(join(root, "package.json"), (pkg) => (pkg.fuyu.experimental = ["timers/v1"])));

test("check without --market lets a plugin under development use experimental interfaces", async () => {
  const dir = experimental();
  const result = await check(dir);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  const out = capture(dir);
  assert.equal(await run(["check"], out.io), 0, out.stderr());
});

test("check --market still refuses experimental interfaces, from the manifest and from the review", async () => {
  const out = capture(experimental());
  assert.equal(await run(["check", "--market", "--json"], out.io), 1);
  const { ok, errors } = JSON.parse(out.stdout());
  assert.equal(ok, false);
  assert.ok(errors.some((issue) => issue.code === "experimental"), JSON.stringify(errors));
  assert.ok(errors.some((issue) => issue.code === "review:manifest" && issue.message.includes("fuyu.experimental")), JSON.stringify(errors));
});

test("check rejects unknown slot names, allows experimental slots in dev mode, and refuses them under --market", async () => {
  const typoDir = copyFixture("hello", (root) => {
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.slots = ["island.dev/v1", "island.nonexistent/v1"];
    });
  });
  const typoResult = await check(typoDir);
  assert.equal(typoResult.ok, false);
  const slotError = typoResult.errors.find((issue) => issue.code === "unknown-slot");
  assert.ok(slotError, JSON.stringify(typoResult.errors));
  assert.equal(slotError.path, "fuyu.slots[1]");
  assert.match(slotError.message, /island\.nonexistent\/v1/);
  assert.match(slotError.message, /island\.page\/v1/);

  const expSlotDir = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/island.tsx": readFileSync(join(root, "src/island.tsx"), "utf8").replace("island.dev/v1", "island.future/v1"),
    });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.slots = ["island.future/v1"];
      pkg.fuyu.experimental = ["island.future/v1"];
    });
  });
  const devResult = await check(expSlotDir);
  assert.equal(devResult.ok, true, JSON.stringify(devResult.errors));
  assert.deepEqual(devResult.errors, []);

  const marketOut = capture(expSlotDir);
  assert.equal(await run(["check", "--market", "--json"], marketOut.io), 1);
  const marketJson = JSON.parse(marketOut.stdout());
  assert.equal(marketJson.ok, false);
  assert.ok(marketJson.errors.some((issue) => issue.code === "unknown-slot" && issue.path === "fuyu.slots[0]"), JSON.stringify(marketJson.errors));
  assert.ok(marketJson.errors.some((issue) => issue.code === "experimental"), JSON.stringify(marketJson.errors));
});

test("check validates service names in provides, replaces and inject while allowing custom versioned services and seams", async () => {
  const validCustom = copyFixture("hello", (root) => {
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.provides = ["weather/v1", "weather.forecast/v2"];
      pkg.fuyu.replaces = ["lyrics/v1"];
      pkg.fuyu.inject = {
        required: ["clients", "commands", "config", "http", "translator.engines", "weather/v1"],
        optional: ["reminders/v1", "clipboard.actions"],
      };
    });
  });
  const validResult = await check(validCustom);
  assert.equal(validResult.ok, true, JSON.stringify(validResult.errors));

  const badServices = copyFixture("hello", (root) => {
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.provides = ["weather"];
      pkg.fuyu.replaces = ["Translator/v1"];
      pkg.fuyu.inject = {
        required: ["clients", "timers/v0"],
        optional: ["translator.engine"],
      };
    });
  });
  const badResult = await check(badServices);
  assert.equal(badResult.ok, false);
  const serviceErrors = badResult.errors.filter((issue) => issue.code === "service-name").map((issue) => issue.path);
  assert.deepEqual(serviceErrors, [
    "fuyu.provides[0]",
    "fuyu.replaces[0]",
    "fuyu.inject.required[1]",
    "fuyu.inject.optional[0]",
  ]);
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

test("dev builds the plugin, registers source: dev in plugins.yml, rebuilds on change and cleans up", async () => {
  const dir = copyFixture();
  const dataDir = tempDir();
  const out = capture(dir);
  assert.equal(await run(["dev", "--once", "--data-dir", dataDir], out.io), 0, out.stderr());
  assert.match(out.stdout(), /dev @someone\/fuyu-hello/);
  const yml = readFileSync(join(dataDir, "plugins.yml"), "utf8");
  assert.match(yml, /- id: "@someone\/fuyu-hello"/);
  assert.match(yml, /source: dev/);

  let rebuilt = 0;
  const session = await dev(dir, {
    dataDir,
    debounceMs: 20,
    onRebuild: () => {
      rebuilt += 1;
    },
  });
  await session.rebuild();
  assert.equal(rebuilt, 1);
  await session.close({ clean: true });
  assert.equal(readFileSync(join(dataDir, "plugins.yml"), "utf8").trim(), "[]");
});

test("check requires experimental windows/v1 for plugin-window.view/v1 slot and windows inject, and refuses both under --market", async () => {
  const missingExp = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/island.tsx": readFileSync(join(root, "src/island.tsx"), "utf8").replace("island.dev/v1", "plugin-window.view/v1"),
    });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.slots = ["plugin-window.view/v1"];
      pkg.fuyu.inject = { required: ["windows"] };
    });
  });
  const missingRes = await check(missingExp);
  assert.equal(missingRes.ok, false);
  assert.ok(missingRes.errors.some((issue) => issue.path === "fuyu.slots[0]" && issue.code === "experimental"));
  assert.ok(missingRes.errors.some((issue) => issue.path === "fuyu.inject.required[0]" && issue.code === "experimental"));

  const withExp = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/island.tsx": readFileSync(join(root, "src/island.tsx"), "utf8").replace("island.dev/v1", "plugin-window.view/v1"),
    });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.slots = ["plugin-window.view/v1"];
      pkg.fuyu.inject = { required: ["windows"] };
      pkg.fuyu.experimental = ["windows/v1"];
    });
  });
  const devRes = await check(withExp);
  assert.equal(devRes.ok, true, JSON.stringify(devRes.errors));

  const marketOut = capture(withExp);
  assert.equal(await run(["check", "--market", "--json"], marketOut.io), 1);
  const marketJson = JSON.parse(marketOut.stdout());
  assert.equal(marketJson.ok, false);
  assert.ok(marketJson.errors.some((issue) => issue.path === "fuyu.slots[0]" && issue.code === "experimental"));
  assert.ok(marketJson.errors.some((issue) => issue.path === "fuyu.inject.required[0]" && issue.code === "experimental"));
});

test("host and window code resolve fuyu-plugin/services while bare fuyu-plugin runtime imports stay blocked in windows", async () => {
  assert.equal(VERSION, "2.0.0");
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/host.ts": 'import type { Context } from "fuyu-plugin";\nimport { timersV1 } from "fuyu-plugin/services";\nexport const inject = ["clients", "timers/v1"];\nexport function apply(ctx: Context) {\n  ctx.services.get(timersV1);\n  ctx.clients.add("island", new URL("./island.js", import.meta.url).href);\n}\n',
      "src/island.tsx": 'import type { Context } from "fuyu-plugin";\nimport { timersV1 } from "fuyu-plugin/services";\nexport default function apply(ctx: Context) {\n  const label = timersV1.name;\n  ctx.slots.add("island.dev/v1", { id: "svc", component: () => <span>{label}</span> });\n}\n',
    });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.inject = { required: ["clients", "timers/v1"] };
    });
  });
  const ok = await check(dir, { allowExperimental: false });
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));

  const badWindow = copyFixture("hello", (root) => {
    writeFiles(root, {
      "src/island.tsx": `import { Service } from "fuyu-plugin";\n${readFileSync(join(root, "src/island.tsx"), "utf8")}\nexport const s = Service;\n`,
    });
  });
  const badRes = await check(badWindow);
  assert.equal(badRes.ok, false);
  assert.ok(badRes.errors.some((issue) => /"fuyu-plugin" is provided by the app/.test(issue.message)), JSON.stringify(badRes.errors));
});
