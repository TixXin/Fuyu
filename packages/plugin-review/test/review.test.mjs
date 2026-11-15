import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderMarkdown, review, run } from "../src/index.mjs";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixture = (version) => join(fixtures, `weather-${version}`);
const scratch = mkdtempSync(join(tmpdir(), "plugin-review-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function variant(name, edit) {
  const dir = join(scratch, name);
  cpSync(fixture("1.0.0"), dir, { recursive: true });
  edit(dir);
  return dir;
}

function compare(newDir, oldDir = fixture("1.0.0")) {
  return review({ oldDir, newDir });
}

const has = (report, predicate) => report.findings.some(predicate);

test("a copy-only update is green", () => {
  const report = compare(fixture("1.0.1"));
  assert.equal(report.tier, "green");
  assert.deepEqual(report.findings, []);
  assert.equal(report.plugin.from, "1.0.0");
  assert.equal(report.plugin.to, "1.0.1");
  assert.ok(report.summary.lines.added > 0);
});

test("an update that adds a child process and phones home to a hidden domain is not green", () => {
  const report = compare(fixture("1.1.0"));
  assert.notEqual(report.tier, "green");
  assert.deepEqual(report.summary.nodeApis.added, ["child_process"]);
  assert.deepEqual(report.summary.network.undeclared, ["collect.weather-stats.net"]);
  assert.ok(has(report, (f) => f.check === "network" && f.detail === "collect.weather-stats.net" && /拼接/.test(f.message) && f.file === "src/host.mjs"));
  assert.ok(has(report, (f) => f.kind === "child-process" && f.line === 2));
  assert.ok(has(report, (f) => f.kind === "dynamic-url"));
  assert.ok(has(report, (f) => f.kind === "home-dir"));
});

test("an update that only bumps a dependency in the lockfile is not green", () => {
  const report = compare(fixture("1.2.0"));
  assert.notEqual(report.tier, "green");
  assert.deepEqual(report.summary.dependencies.changed, [{ name: "tiny-format", from: ["1.2.0"], to: ["1.2.1"] }]);
  assert.ok(report.findings.every((f) => f.check === "dependencies"));
});

test("a first release is at least yellow", () => {
  const report = review({ newDir: fixture("1.0.0") });
  assert.equal(report.tier, "yellow");
  assert.equal(report.firstRelease, true);
  assert.equal(report.plugin.from, null);
  assert.ok(has(report, (f) => f.check === "release"));
});

test("a native addon or an executable is red", () => {
  const native = variant("native", (dir) => writeFileSync(join(dir, "src", "addon.node"), Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0, 0, 0, 0])));
  assert.equal(compare(native).tier, "red");
  const exe = variant("exe", (dir) => writeFileSync(join(dir, "helper.bin.txt"), Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)])));
  const report = compare(exe);
  assert.equal(report.tier, "red");
  assert.ok(has(report, (f) => f.tier === "red" && f.file === "helper.bin.txt"));
});

test("a non-empty experimental list is red", () => {
  const dir = variant("experimental", (root) => {
    const path = join(root, "package.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.fuyu.experimental = ["island.dock/v0"];
    writeFileSync(path, JSON.stringify(manifest, null, 2));
  });
  const report = compare(dir);
  assert.equal(report.tier, "red");
  assert.ok(has(report, (f) => f.check === "manifest" && f.detail === "island.dock/v0"));
});

test("obfuscated code is red", () => {
  const names = variant("hexnames", (dir) => writeFileSync(join(dir, "src", "x.mjs"), "var _0x1a2b=1,_0x3c4d=2,_0x5e6f=3;export default _0x1a2b+_0x3c4d+_0x5e6f;\n"));
  assert.equal(compare(names).tier, "red");
  const escapes = variant("escapes", (dir) => writeFileSync(join(dir, "src", "x.mjs"), `export const k = "${"\\x68\\x74\\x74\\x70".repeat(4)}";\n`));
  assert.equal(compare(escapes).tier, "red");
  const codes = variant("codes", (dir) => writeFileSync(join(dir, "src", "x.mjs"), "export const k = String.fromCharCode(104,116,116,112,115,58,47,47,101);\n"));
  assert.equal(compare(codes).tier, "red");
});

test("a large base64 blob is yellow and stays quiet once it was reviewed", () => {
  const blob = Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 37) % 256)).toString("base64");
  const dir = variant("blob", (root) => writeFileSync(join(root, "src", "blob.mjs"), `export const blob = "${blob}";\n`));
  const report = compare(dir);
  assert.equal(report.tier, "yellow");
  assert.ok(has(report, (f) => f.kind === "base64-block"));
  assert.ok(!has(compare(dir, dir), (f) => f.kind === "base64-block"));
});

test("sensitive patterns are yellow", () => {
  const cases = {
    eval: "export const run = (s) => eval(s);\n",
    "function-constructor": "export const run = (s) => new Function(s)();\n",
    "import-nonliteral": "export const load = (name) => import(name);\n",
    "require-nonliteral": "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nexport const load = (n) => require('./' + n);\n",
    vm: "import vm from 'node:vm';\nexport const run = (s) => vm.runInNewContext(s);\n",
    "home-dir": "import os from 'node:os';\nexport const home = os.homedir();\n",
    "absolute-path": "export const target = '/Users/me/Library/Keychains';\n",
    "parent-path": "export const target = '../../other-plugin/data.json';\n",
    "app-data": "export const target = 'Library/Application Support/com.tixxin.fuyu/agent-status.json';\n",
  };
  for (const [kind, source] of Object.entries(cases)) {
    const dir = variant(`sensitive-${kind}`, (root) => writeFileSync(join(root, "src", "extra.mjs"), source));
    const report = compare(dir);
    assert.ok(has(report, (f) => f.kind === kind), `${kind}: ${JSON.stringify(report.findings)}`);
    assert.notEqual(report.tier, "green", kind);
  }
});

test("literal imports, URLs in comments and declared hosts stay green", () => {
  const source = [
    "// see https://evil.example-tracker.net for docs",
    "/* fetch('https://another-tracker.io') */",
    "import { join } from 'node:path';",
    "const page = await import('./page.mjs');",
    "const re = /https:\\/\\/not-a-host\\.com/;",
    "export const url = `https://api.open-meteo.com/v1/${page}`;",
    "export const p = join('a', 'b');",
    "export const command = 'weather.refresh';",
  ].join("\n");
  const dir = variant("benign", (root) => writeFileSync(join(root, "src", "benign.mjs"), source));
  assert.deepEqual(compare(dir).findings, []);
});

test("provides, replaces and network changes are yellow", () => {
  const dir = variant("services", (root) => {
    const path = join(root, "package.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.fuyu.replaces = ["translation"];
    manifest.fuyu.network.push("*.weather-stats.net");
    writeFileSync(path, JSON.stringify(manifest, null, 2));
  });
  const report = compare(dir);
  assert.equal(report.tier, "yellow");
  assert.ok(has(report, (f) => f.message.includes("replaces") && f.detail === "translation"));
  assert.ok(has(report, (f) => f.check === "network" && f.detail === "*.weather-stats.net"));
});

test("more than 300 changed lines is yellow", () => {
  const lines = Array.from({ length: 320 }, (_, i) => `export const label${i} = "label ${i}";`).join("\n");
  const dir = variant("big", (root) => writeFileSync(join(root, "src", "labels.mjs"), lines));
  const report = compare(dir);
  assert.equal(report.tier, "yellow");
  assert.ok(has(report, (f) => f.check === "size"));
});

test("the markdown names the tier, every finding and neutralizes backticks", () => {
  const report = compare(fixture("1.1.0"));
  const markdown = renderMarkdown(report);
  assert.match(markdown, /黄档/);
  assert.match(markdown, /collect\.weather-stats\.net/);
  assert.match(markdown, /`src\/host\.mjs:2`/);
  const tricky = renderMarkdown({ ...report, plugin: { ...report.plugin, name: "a`b @someone" } });
  assert.match(tricky, /``a`b @someone``/);
  assert.match(renderMarkdown(compare(fixture("1.0.1"))), /绿档/);
});

test("the command line exits 1 on red and writes both reports", () => {
  const output = { text: "", write(chunk) { this.text += chunk; } };
  const json = join(scratch, "report.json");
  const markdown = join(scratch, "report.md");
  assert.equal(run([fixture("1.0.0"), fixture("1.1.0"), "--json", json, "--markdown", markdown], { stdout: output, stderr: output }), 0);
  assert.equal(JSON.parse(readFileSync(json, "utf8")).tier, "yellow");
  assert.match(readFileSync(markdown, "utf8"), /黄档/);
  const native = join(scratch, "native");
  assert.equal(run([fixture("1.0.0"), native, "--format", "json"], { stdout: output, stderr: output }), 1);
  assert.equal(run(["only-one"], { stdout: output, stderr: output }), 2);
});
