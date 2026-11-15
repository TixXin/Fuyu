import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readPackage, validateManifest } from "@fuyu/plugin-manifest";
import { SHARED_MODULES } from "@fuyu/plugin-base/protocol";
import { BuildError, DEFAULT_SHARED_MODULES, INSTALLED_PACKAGE_DEPTH, VERSION, build, pack, sharedPath } from "../src/index.mjs";
import { copyFixture, editJson, tempDir, writeFiles } from "./helpers.mjs";

const read = (dir, path) => readFileSync(join(dir, path), "utf8");

function allFiles(dir, prefix = "") {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? allFiles(dir, path) : [path];
  });
}

test("hello builds into a package folder with the generated manifest fields", async () => {
  const dir = copyFixture();
  const result = await build(dir);
  assert.deepEqual(result.files, ["LICENSE", "README.md", "assets/icon.svg", "dist/host.js", "dist/island.js", "package.json"]);
  assert.deepEqual(allFiles(result.outDir).sort(), result.files);
  assert.deepEqual(result.nodeApis, ["os"]);
  assert.deepEqual(result.warnings, []);
  const manifest = JSON.parse(read(result.outDir, "package.json"));
  assert.deepEqual(manifest.fuyu.nodeApis, ["os"]);
  assert.equal(manifest.fuyu.builtWith, VERSION);
  assert.equal(validateManifest(manifest, { allowExperimental: false }).ok, true);
});

test("the host part is ESM for Node with the kernel left outside, the window part imports the shared React", async () => {
  const { outDir } = await build(copyFixture());
  const host = read(outDir, "dist/host.js");
  assert.match(host, /^import \{ Service \} from "@fuyu\/plugin-base";$/m);
  assert.match(host, /^import \{ hostname \} from "node:os";$/m);
  assert.match(host, /from the plugin host/);
  assert.match(host, /export \{\n {2}Hello as default\n\};/);
  const island = read(outDir, "dist/island.js");
  assert.match(island, /from "\/__shared\/react\.js";/);
  assert.match(island, /from "\/__shared\/react-jsx-runtime\.js";/);
  assert.doesNotMatch(island, /from "react/);
  assert.match(island, /\.fuyu-hello__count \{/);
  assert.match(island, /style\.dataset\.fuyuPlugin = "@someone\/fuyu-hello";/);
  assert.match(island, /export \{\n {2}applyWithStyles as default\n\};/);
});

test("the same source builds to the same bytes in different folders, and the package reads back", async () => {
  const first = await pack(copyFixture("hello", () => {}, tempDir("first")));
  const second = await pack(copyFixture("hello", () => {}, tempDir("second-with-a-longer-name")));
  assert.equal(first.sha256, second.sha256);
  assert.deepEqual(readFileSync(first.file), readFileSync(second.file));
  assert.match(first.file, /someone-fuyu-hello-1\.0\.0\.fuyu$/);
  for (const path of ["dist/host.js", "dist/island.js"]) assert.equal(read(first.outDir, path).includes(first.dir), false);
  const opened = readPackage(readFileSync(first.file));
  assert.equal(opened.digest, first.digest);
  assert.deepEqual(opened.files.map((file) => file.path), first.files);
  const checked = validateManifest(opened.manifest, { allowExperimental: false });
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  assert.deepEqual(checked.app.nodeApis, ["os"]);
});

test("npm dependencies are bundled into the host part, and CommonJS requires get a require of their own", async () => {
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, {
      "node_modules/tiny-format/package.json": '{ "name": "tiny-format", "version": "1.0.0", "main": "index.js" }\n',
      "node_modules/tiny-format/index.js": 'const { join } = require("path");\nmodule.exports = (a, b) => join(a, b);\n',
      "src/host.ts": `${read(root, "src/host.ts")}\nimport format from "tiny-format";\nexport const where = format("a", "b");\n`,
    });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.dependencies = { "tiny-format": "^1.0.0" };
      pkg.scripts = { postinstall: "node evil.js" };
    });
  });
  const result = await build(dir);
  const host = read(result.outDir, "dist/host.js");
  assert.match(host, /node_modules\/tiny-format\/index\.js/);
  assert.match(host, /^import \{ createRequire as __fuyuCreateRequire \} from "node:module";$/m);
  assert.deepEqual(result.nodeApis, ["module", "os", "path"]);
  assert.equal(result.manifest.dependencies, undefined);
  assert.equal(result.manifest.scripts, undefined);
});

test("the shared module list comes from @fuyu/plugin-base/protocol, and the list and relative paths are parameters", async () => {
  assert.deepEqual(DEFAULT_SHARED_MODULES, SHARED_MODULES);
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, { "src/island.tsx": `import { host } from "fuyu-plugin";\n${read(root, "src/island.tsx")}\nexport const h = host;\n` });
  });
  const shared = { react: "__shared/react.js", "react/jsx-runtime": "__shared/react-jsx-runtime.js", "fuyu-plugin": "__shared/fuyu-plugin.js" };
  const { outDir } = await build(dir, { shared, packageDepth: true });
  const island = read(outDir, "dist/island.js");
  assert.equal(INSTALLED_PACKAGE_DEPTH, 3);
  assert.match(island, /import \{ host \} from "\.\.\/\.\.\/\.\.\/\.\.\/__shared\/fuyu-plugin\.js";/);
  const imports = [...island.matchAll(/from "([^"]*__shared[^"]*)";/g)].map((match) => match[1]);
  const installed = ["fuyu-plugin://localhost/packages/@a/b/dist/island.js", "fuyu-plugin://localhost/packages/b/dist/island.js", "http://fuyu-plugin.localhost/packages/@a/b/dist/island.js"];
  for (const base of installed) {
    assert.deepEqual(imports.map((path) => new URL(path, base).pathname).sort(), ["/__shared/fuyu-plugin.js", "/__shared/react-jsx-runtime.js", "/__shared/react.js"], base);
  }
  assert.equal(sharedPath("dist/pages/settings.js", "__shared/react.js", 0), "../../__shared/react.js");
  assert.equal(sharedPath("dist/pages/settings.js", "__shared/react.js"), "/__shared/react.js");
  assert.match(read((await build(dir, { shared, packageDepth: false })).outDir, "dist/island.js"), /from "\/__shared\/react\.js";/);
  await assert.rejects(build(dir, { packageDepth: -1 }), /packageDepth must be true or a whole number/);
  await assert.rejects(build(dir, { packageDepth: "3" }), /packageDepth must be true or a whole number/);
});

test("window code cannot bundle its own copy of a module the app provides", async () => {
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, { "src/island.tsx": `import { createRoot } from "react-dom/client";\n${read(root, "src/island.tsx")}\nexport const c = createRoot;\n` });
  });
  await assert.rejects(build(dir), (error) => error instanceof BuildError && error.issues.some((issue) => /react-dom\/client.*provided by the app/.test(issue.message)));
});

test("entries are found by convention: dist/<name>.js is built from src/<name>.*", async () => {
  const missing = copyFixture("hello", (root) => editJson(join(root, "package.json"), (pkg) => (pkg.fuyu.client = { island: "dist/island.js", settings: "dist/settings.js" })));
  await assert.rejects(build(missing), /no src\/settings\.ts/);
  const outside = copyFixture("hello", (root) => editJson(join(root, "package.json"), (pkg) => (pkg.fuyu.host = "host.js")));
  await assert.rejects(build(outside), /must point into dist\//);
  const twice = copyFixture("hello", (root) => writeFiles(root, { "src/host.js": "export default 1;\n" }));
  await assert.rejects(build(twice), /more than one source/);
  const invalid = copyFixture("hello", (root) => editJson(join(root, "package.json"), (pkg) => (pkg.name = "@fuyu/hello")));
  await assert.rejects(build(invalid), (error) => error instanceof BuildError && error.issues.some((issue) => issue.code === "name-reserved"));
  assert.ok(await build(invalid, { official: true }));
});

test("declarations are compared with the code", async () => {
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, { "src/host.ts": `${read(root, "src/host.ts")}\nexport const send = () => fetch("https://collect.weather-stats.net/x");\n` });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.fuyu.slots = ["island.page/v1"];
      pkg.fuyu.nodeApis = ["fs"];
    });
  });
  const { warnings } = await build(dir);
  const codes = warnings.map((warning) => `${warning.code}:${warning.file ?? warning.path}`);
  assert.deepEqual(codes.sort(), ["node-apis:fuyu.nodeApis", "undeclared-domain:dist/host.js", "undeclared-slot:dist/island.js"]);
  assert.match(warnings.find((warning) => warning.code === "undeclared-domain").message, /collect\.weather-stats\.net/);
});

test("files, the icon, screenshots and the config go into the package; dist/ in the source does not", async () => {
  const dir = copyFixture("hello", (root) => {
    writeFiles(root, {
      "dist/stale.js": "old\n",
      "docs/guide.md": "# Guide\n",
      "media/shot.png": "png",
      "src/config.schema.json": '{ "type": "object" }\n',
      "CHANGELOG.md": "# 1.0.0\n",
      "assets/.DS_Store": "",
    });
    editJson(join(root, "package.json"), (pkg) => {
      pkg.files = ["assets", "docs/guide.md", "dist"];
      pkg.fuyu.screenshots = [{ path: "media/shot.png" }];
      pkg.fuyu.config = "dist/config.schema.json";
    });
  });
  const { files } = await build(dir);
  assert.deepEqual(files, ["CHANGELOG.md", "LICENSE", "README.md", "assets/icon.svg", "dist/config.schema.json", "dist/host.js", "dist/island.js", "docs/guide.md", "media/shot.png", "package.json"]);
  const pattern = copyFixture("hello", (root) => editJson(join(root, "package.json"), (pkg) => (pkg.files = ["assets/*.svg"])));
  await assert.rejects(build(pattern), /is a pattern/);
});

test("a build only empties a folder that holds an earlier build", async () => {
  const dir = copyFixture();
  const out = join(dir, "elsewhere");
  mkdirSync(out);
  writeFileSync(join(out, "notes.txt"), "keep me\n");
  await assert.rejects(build(dir, { outDir: out }), /refusing to empty/);
  assert.equal(read(out, "notes.txt"), "keep me\n");
  await assert.rejects(build(dir, { outDir: join(dir, "..") }), /must not contain the plugin folder/);
  await build(dir);
  await build(dir);
});
