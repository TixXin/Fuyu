import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { build, check } from "@fuyu/plugin-cli";
import { HOST_SHARED_MODULES, SLOT_THEME } from "@fuyu/plugin-base/protocol";
import { EXPERIMENTAL } from "@fuyu/create-plugin";
import { ESLINT, TSC, generate, run, tempDir } from "./helpers.mjs";

test("a generated project type-checks, passes its own lint rules, builds and passes fuyu-plugin check", async () => {
  const { options } = generate();
  const dir = options.dir;
  const typecheck = run(dir, TSC, ["-p", "."]);
  assert.equal(typecheck.status, 0, typecheck.output);
  const lint = run(dir, ESLINT, ["."]);
  assert.equal(lint.status, 0, lint.output);

  const built = await build(dir, { outDir: join(tempDir("built"), "package") });
  assert.deepEqual(built.warnings, []);
  assert.deepEqual(built.manifest.fuyu.nodeApis, []);
  assert.equal(built.manifest.fuyu.experimental, undefined);
  assert.equal(built.manifest.devDependencies, undefined);
  const host = readFileSync(join(built.outDir, "dist", "host.js"), "utf8");
  const imports = [...host.matchAll(/^import .* from "([^"]+)";$/gm)].map(([, specifier]) => specifier);
  assert.deepEqual(imports.filter((specifier) => !HOST_SHARED_MODULES.includes(specifier)), []);
  const island = readFileSync(join(built.outDir, "dist", "island.js"), "utf8");
  assert.match(island, /from "\/__shared\/react\.js"/);
  assert.match(island, /\.fuyu-pomodoro__button/);

  const result = await check(dir);
  assert.deepEqual(result.errors, [], JSON.stringify(result.errors, null, 2));
  assert.equal(result.ok, true);
  const market = await check(dir, { allowExperimental: false });
  assert.equal(market.ok, true);
});

test("the styles only use the slot's theme variables", () => {
  const { options } = generate({ name: "styles" });
  const css = readFileSync(join(options.dir, "src", "styles.css"), "utf8");
  const used = [...css.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name);
  assert.ok(used.length > 0);
  assert.deepEqual(used.filter((name) => !SLOT_THEME.includes(name)), []);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

const VIOLATIONS = [
  ["setTimeout(() => {}, 10);", "no-restricted-globals"],
  ["setInterval(() => {}, 10);", "no-restricted-globals"],
  ["window.setTimeout(() => {}, 10);", "no-restricted-properties"],
  ["globalThis.setInterval(() => {}, 10);", "no-restricted-properties"],
  ['document.addEventListener("keydown", () => {});', "no-restricted-properties"],
  ['const style = document.createElement("style");', "no-restricted-syntax"],
  ["document.head.append(style);", "no-restricted-properties"],
  ["document.adoptedStyleSheets = [new CSSStyleSheet()];", "no-restricted-properties"],
  ["document.adoptedStyleSheets[0]?.insertRule('.x { color: red }');", "no-restricted-properties"],
];

test("the lint rules stop raw timers, raw listeners and injected styles, and point to the managed versions", () => {
  const { options } = generate({ name: "lint" });
  const file = join(options.dir, "src", "bad.ts");
  writeFileSync(file, `${VIOLATIONS.map(([line]) => line).join("\n")}\nexport {};\n`);
  const lint = run(options.dir, ESLINT, ["--format", "json", "src/bad.ts"]);
  assert.equal(lint.status, 1, lint.output);
  const [report] = JSON.parse(lint.stdout);
  const found = report.messages.map((message) => [message.line, message.ruleId]);
  VIOLATIONS.forEach(([code, rule], index) => assert.ok(found.some(([line, id]) => line === index + 1 && id === rule), `${code} → ${rule}; got ${JSON.stringify(found)}`));
  const texts = report.messages.map((message) => message.message).join("\n");
  assert.match(texts, /ctx\.setTimeout/);
  assert.match(texts, /ctx\.host\.on/);
  assert.match(texts, /import "\.\/styles\.css"/);
});

test("ctx.setTimeout and other members named like the globals stay allowed", () => {
  const { options } = generate({ name: "allowed" });
  writeFileSync(
    join(options.dir, "src", "fine.ts"),
    'import type { Context } from "@fuyu/plugin-base";\nexport function apply(ctx: Context) {\n  ctx.setTimeout(() => {}, 10);\n  ctx.setInterval(() => {}, 10);\n  void ctx.sleep(10);\n}\n',
  );
  const lint = run(options.dir, ESLINT, ["src/fine.ts"]);
  assert.equal(lint.status, 0, lint.output);
});
