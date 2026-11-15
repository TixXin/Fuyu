import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { validateManifest } from "@fuyu/plugin-manifest";
import { SHARED_MODULES, SLOTS } from "@fuyu/plugin-base/protocol";
import { timersV1 } from "@fuyu/plugin-services";
import { EXPERIMENTAL, FUYU_PACKAGES, SERVICES_USED, SLOTS_USED, TOOLS, findCheckout, main, normalizeOptions, projectFiles, scaffold } from "@fuyu/create-plugin";
import { OPTIONS, REPO_ROOT, tempDir } from "./helpers.mjs";

test("options name the package @<owner>/<name> after the repository owner, with readable defaults", () => {
  const options = normalizeOptions({ ...OPTIONS, dir: "x" });
  assert.equal(options.packageName, "@someone/fuyu-pomodoro");
  assert.equal(options.repository, "github:SomeOne/fuyu-pomodoro");
  assert.deepEqual(options.displayName, { "zh-CN": "番茄钟", en: "Pomodoro" });
  assert.equal(options.css, "fuyu-pomodoro");
  assert.equal(options.checkout, findCheckout(REPO_ROOT));
  const plain = normalizeOptions({ owner: "ann", name: "2-clocks.v2" });
  assert.deepEqual(plain.displayName, { "zh-CN": "2 clocks v2", en: "2 clocks v2" });
  assert.equal(plain.css, "plugin-2-clocks-v2");
});

test("bad owners, names, repositories and the official scope are refused before anything is written", () => {
  assert.throws(() => normalizeOptions({ name: "x" }), /owner/);
  assert.throws(() => normalizeOptions({ owner: "-ann" }), /owner/);
  assert.throws(() => normalizeOptions({ owner: "ann", name: "Big Name" }), /name/);
  assert.throws(() => normalizeOptions({ owner: "ann", repository: "not a repo" }), /repository/);
  assert.throws(() => normalizeOptions({ owner: "ann", repository: "github:bob/clock" }), /scope @ann must be the repository owner/);
  assert.throws(() => normalizeOptions({ owner: "fuyu" }), /reserved/);
  assert.throws(() => normalizeOptions({ owner: "ann", fuyu: tempDir("not-fuyu") }), /not a checkout of TixXin\/fuyu/);
});

test("every placeholder is filled, and display names are escaped inside the code", () => {
  const files = projectFiles(normalizeOptions({ ...OPTIONS, displayName: 'Say "hi" \\ now', dir: "x" }));
  for (const [path, text] of files) assert.doesNotMatch(text, /\{\{\w+\}\}/, path);
  assert.match(files.get("src/text.ts"), /title: "Say \\"hi\\" \\\\ now"/);
  assert.match(files.get("src/styles.css"), /^\.fuyu-pomodoro \{/);
  assert.deepEqual([...files.keys()], [".gitignore", "assets/icon.svg", "eslint.config.mjs", "LICENSE", "package.json", "README.md", "src/host.ts", "src/island.tsx", "src/settings.tsx", "src/styles.css", "src/text.ts", "src/timers.ts", "src/useTimers.ts", "tsconfig.json"]);
});

test("the manifest passes as source, lists every interface it uses as experimental, and links Fuyu's packages from the checkout", () => {
  const options = normalizeOptions({ ...OPTIONS, dir: "x" });
  const pkg = JSON.parse(projectFiles(options).get("package.json"));
  assert.equal(validateManifest(pkg, { stage: "source", allowExperimental: true }).ok, true);
  assert.equal(validateManifest(pkg, { stage: "source", allowExperimental: false }).ok, false);
  assert.deepEqual(pkg.fuyu.experimental, [...EXPERIMENTAL]);
  assert.deepEqual(pkg.fuyu.slots, [...SLOTS_USED]);
  for (const slot of SLOTS_USED) assert.ok(SLOTS[slot], slot);
  assert.ok(SERVICES_USED.includes(timersV1.name));
  assert.deepEqual(pkg.fuyu.inject.required, [...SERVICES_USED]);
  for (const [name, path] of Object.entries(FUYU_PACKAGES)) assert.equal(pkg.devDependencies[name], `file:${join(options.checkout, path).split("\\").join("/")}`);
  const sources = [...projectFiles(options)].filter(([path]) => path.startsWith("src/")).map(([, text]) => text).join("\n");
  for (const name of SLOTS_USED) assert.ok(sources.includes(`ctx.slots.add("${name}"`), name);
  assert.deepEqual(Object.keys(pkg.fuyu.client), ["island", "settings"]);
  assert.doesNotMatch(sources, /ctx\.clients\.add\(/);
  for (const module of Object.keys(SHARED_MODULES)) assert.equal(pkg.devDependencies[module], undefined);
});

test("the tool versions follow the repository's own, so the template is checked with what it asks for", () => {
  const root = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  for (const [name, range] of Object.entries(TOOLS)) assert.equal(root.devDependencies[name], range, name);
});

test("the command line writes the project, refuses a folder that is not empty, and prints the next steps", async () => {
  const cwd = tempDir("cli");
  const lines = [];
  const io = { cwd, interactive: false, log: (text) => lines.push(text) };
  assert.equal(await main(["clock", "--owner", "ann", "--name", "clock"], io), 0);
  assert.ok(existsSync(join(cwd, "clock", "src", "host.ts")));
  assert.match(lines.join("\n"), /Created @ann\/clock in clock/);
  assert.match(lines.join("\n"), /npm install/);
  writeFileSync(join(cwd, "taken"), "");
  assert.throws(() => scaffold({ owner: "ann", dir: cwd }), /is not empty/);
  lines.length = 0;
  assert.equal(await main(["--help"], io), 0);
  assert.match(lines[0], /npm create fuyu-plugin@latest/);
});
