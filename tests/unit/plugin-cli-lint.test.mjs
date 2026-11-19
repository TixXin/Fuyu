import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, lintListing, run } from "../../packages/plugin-cli/src/index.mjs";

const HELLO = fileURLToPath(new URL("../../packages/plugin-cli/test/fixtures/hello", import.meta.url));
const OFFICIAL_ROOT = fileURLToPath(new URL("../../plugins/v3/official", import.meta.url));
const PENDING = {
  "listing:screenshots": ["ecdict", "now-playing", "system-monitor", "todo-digest"],
};

const scratch = mkdtempSync(join(tmpdir(), "plugin-cli-lint-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let next = 0;

function hello(edit = () => {}) {
  const dir = join(scratch, `${++next}`, "hello");
  cpSync(HELLO, dir, { recursive: true });
  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  edit(pkg, dir);
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  return dir;
}

function capture(cwd) {
  const stdout = [];
  const stderr = [];
  return {
    io: { cwd, env: {}, stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) } },
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
  };
}

const codes = (issues) => issues.map((issue) => issue.code);

test("a plugin without a screenshot gets a warning from check, an error with --strict, and nothing once it lists one", async () => {
  const bare = hello();
  const warned = capture(bare);
  assert.equal(await run(["check"], warned.io), 0, warned.stderr());
  assert.match(warned.stderr(), /warning: fuyu\.screenshots: no screenshots.*\[listing:screenshots\]/);
  const strict = capture(bare);
  assert.equal(await run(["check", "--strict"], strict.io), 1);
  assert.match(strict.stderr(), /error: fuyu\.screenshots: no screenshots/);

  const quiet = await check(bare);
  assert.deepEqual(codes(quiet.warnings), []);
  const asError = await check(bare, { listing: "error" });
  assert.equal(asError.ok, false);
  assert.deepEqual(codes(asError.errors), ["listing:screenshots"]);

  const shown = hello((pkg, dir) => {
    pkg.fuyu.screenshots = [{ path: "assets/page.png" }];
    writeFileSync(join(dir, "assets", "page.png"), "png");
  });
  const clean = await check(shown, { listing: "error" });
  assert.deepEqual(clean.errors, []);
  assert.deepEqual(codes(clean.warnings), []);
});

test("official plugins pass the listing checks, except the ones still waiting for E77.6", () => {
  const found = {};
  for (const slug of readdirSync(OFFICIAL_ROOT).sort()) {
    const dir = join(OFFICIAL_ROOT, slug);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    for (const issue of lintListing(dir, manifest)) (found[issue.code] ??= []).push(slug);
  }
  assert.deepEqual(found, PENDING);
});
